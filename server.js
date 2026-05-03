const express      = require('express');
const path         = require('path');
const fs           = require('fs');
const os           = require('os');
const cors         = require('cors');
const Datastore    = require('nedb-promises');
const { v4: uuidv4 } = require('uuid');
const bwipjs       = require('bwip-js');
const PDFDocument  = require('pdfkit');

// pdf-to-printer bundles a Windows-only binary — load only on Windows (local server).
// On Vercel/Linux the direct-print endpoints return a graceful "unavailable" response.
let printPDF, getPrinters;
if (process.platform === 'win32') {
  try {
    ({ print: printPDF, getPrinters } = require('pdf-to-printer'));
  } catch (_) {}
}

const app  = express();
const PORT = process.env.PORT || 3000;

// Vercel's filesystem is read-only except /tmp; use /tmp/data when deployed.
const dataDir = process.env.VERCEL
  ? '/tmp/data'
  : path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = {
  categories: Datastore.create({ filename: path.join(dataDir, 'categories.db'), autoload: true }),
  products:   Datastore.create({ filename: path.join(dataDir, 'products.db'),   autoload: true }),
  printJobs:  Datastore.create({ filename: path.join(dataDir, 'print_jobs.db'), autoload: true }),
};

const DEMO_SKUS = [
  'MOB-SAM-S24-BLK','MOB-APL-IP15-BLU','ACC-SAM-USBC-1M','AUD-BOT-255P-BLK',
  'AC-LG-1T5-5S','REF-SAM-253L-SLV','TV-SON-55-4K','FURN-GOD-DESK-WAL',
  'LAP-HP-PAV15-SLV','WM-WPL-7KG-FL',
];

async function seed() {
  const removed = await db.products.remove({ sku: { $in: DEMO_SKUS } }, { multi: true });
  if (removed > 0) console.log(`Removed ${removed} demo product(s)`);

  const catCount = await db.categories.count({});
  if (catCount === 0) {
    await db.categories.insert([
      { _id: 'cat_mob',   name: 'Mobiles',            icon: '📱' },
      { _id: 'cat_acc',   name: 'Mobile Accessories', icon: '🔌' },
      { _id: 'cat_tv',    name: 'Televisions',         icon: '📺' },
      { _id: 'cat_ref',   name: 'Refrigerators',       icon: '🧊' },
      { _id: 'cat_wm',    name: 'Washing Machines',    icon: '🫧' },
      { _id: 'cat_ac',    name: 'Air Conditioners',    icon: '❄️' },
      { _id: 'cat_kit',   name: 'Kitchen Appliances',  icon: '🍳' },
      { _id: 'cat_furn',  name: 'Furniture',           icon: '🪑' },
      { _id: 'cat_lap',   name: 'Laptops & Computers', icon: '💻' },
      { _id: 'cat_audio', name: 'Audio & Headphones',  icon: '🎧' },
      { _id: 'cat_cam',   name: 'Cameras',             icon: '📷' },
      { _id: 'cat_other', name: 'Other Electronics',   icon: '⚡' },
    ]);
    console.log('Categories seeded');
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Categories ────────────────────────────────────────────────────────────────
app.get('/api/categories', async (_req, res) => {
  const cats = await db.categories.find({}).sort({ name: 1 });
  res.json(cats.map(c => ({ ...c, id: c._id })));
});

// ── Products ──────────────────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  const { category, search, page = 1, limit = 15, low_stock } = req.query;
  let query = {};
  if (category) query.category_id = category;
  if (low_stock === '1') query.stock = { $lte: 5 };
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ name: rx }, { brand: rx }, { sku: rx }, { serial_no: rx }, { model_no: rx }];
  }
  const total    = await db.products.count(query);
  const skip     = (parseInt(page) - 1) * parseInt(limit);
  const products = await db.products.find(query).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit));
  const cats     = await db.categories.find({});
  const catMap   = {};
  cats.forEach(c => { catMap[c._id] = c; });
  const enriched = products.map(p => ({
    ...p, id: p._id,
    category_name: catMap[p.category_id]?.name || '',
    category_icon: catMap[p.category_id]?.icon || '',
  }));
  res.json({ products: enriched, total, page: parseInt(page), limit: parseInt(limit) });
});

app.get('/api/products/:id', async (req, res) => {
  const p = await db.products.findOne({ _id: req.params.id });
  if (!p) return res.status(404).json({ error: 'Not found' });
  const cat = await db.categories.findOne({ _id: p.category_id });
  res.json({ ...p, id: p._id, category_name: cat?.name || '', category_icon: cat?.icon || '' });
});

app.post('/api/products', async (req, res) => {
  const { name, brand, category_id, mrp, selling_price, model_no, color, size, stock, gst_rate, hsn_code, description } = req.body;
  if (!name || !mrp) return res.status(400).json({ error: 'name and mrp required' });
  const id        = uuidv4();
  const serial_no = await generateSerialNo();
  const sku       = generateSKU(category_id, serial_no);
  const doc       = {
    _id: id, serial_no, name, brand: brand || '',
    category_id: category_id || 'cat_other',
    mrp: parseFloat(mrp), selling_price: parseFloat(selling_price || mrp),
    sku, model_no: model_no || '', color: color || '', size: size || '',
    stock: parseInt(stock || 0), gst_rate: parseFloat(gst_rate || 18),
    hsn_code: hsn_code || '', description: description || '',
    created_at: new Date().toISOString(),
  };
  await db.products.insert(doc);
  res.json({ ...doc, id: doc._id });
});

app.put('/api/products/:id', async (req, res) => {
  const { name, brand, category_id, mrp, selling_price, model_no, color, size, stock, gst_rate, hsn_code, description } = req.body;
  await db.products.update({ _id: req.params.id }, {
    $set: {
      name, brand, category_id,
      mrp: parseFloat(mrp), selling_price: parseFloat(selling_price || mrp),
      model_no: model_no || '', color: color || '', size: size || '',
      stock: parseInt(stock || 0), gst_rate: parseFloat(gst_rate || 18),
      hsn_code: hsn_code || '', description: description || '',
    }
  });
  const p = await db.products.findOne({ _id: req.params.id });
  res.json({ ...p, id: p._id });
});

app.delete('/api/products/:id', async (req, res) => {
  await db.products.remove({ _id: req.params.id }, {});
  res.json({ success: true });
});

// ── Stock Adjustment ──────────────────────────────────────────────────────────
app.patch('/api/products/:id/stock', async (req, res) => {
  const { delta, stock } = req.body;
  const p = await db.products.findOne({ _id: req.params.id });
  if (!p) return res.status(404).json({ error: 'Not found' });
  const newStock = stock !== undefined
    ? Math.max(0, parseInt(stock))
    : Math.max(0, (p.stock || 0) + parseInt(delta || 0));
  await db.products.update({ _id: req.params.id }, { $set: { stock: newStock } });
  res.json({ id: req.params.id, stock: newStock });
});

// ── QR Code ───────────────────────────────────────────────────────────────────
app.get('/api/qr/:code', async (req, res) => {
  const scale = Math.min(10, Math.max(2, parseInt(req.query.scale) || 4));
  try {
    const png = await bwipjs.toBuffer({ bcid: 'qrcode', text: req.params.code, scale, eclevel: 'M' });
    res.set('Content-Type', 'image/png').set('Cache-Control', 'public,max-age=86400').send(png);
  } catch (e) { res.status(400).json({ error: 'QR generation failed' }); }
});

// ── Linear barcode (CODE-128) ─────────────────────────────────────────────────
app.get('/api/barcode/:code', async (req, res) => {
  const scale  = Math.min(4, Math.max(1, parseInt(req.query.scale)  || 2));
  const height = Math.min(30, Math.max(5, parseInt(req.query.height) || 12));
  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128', text: req.params.code, scale, height,
      includetext: false, backgroundcolor: 'ffffff',
    });
    res.set('Content-Type', 'image/png').set('Cache-Control', 'public,max-age=86400').send(png);
  } catch (e) { res.status(400).json({ error: 'Barcode generation failed' }); }
});

// ── Print Jobs ────────────────────────────────────────────────────────────────
app.post('/api/print-jobs', async (req, res) => {
  const { items, deductStock } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'items required' });
  const total = items.reduce((s, i) => s + (i.qty || 1), 0);
  if (deductStock) {
    for (const item of items) {
      const p = await db.products.findOne({ _id: item.productId });
      if (p) {
        const newStock = Math.max(0, (p.stock || 0) - (item.qty || 1));
        await db.products.update({ _id: item.productId }, { $set: { stock: newStock } });
      }
    }
  }
  const id = uuidv4();
  await db.printJobs.insert({
    _id: id, total_labels: total, job_data: items,
    deduct_stock: !!deductStock, created_at: new Date().toISOString(),
  });
  res.json({ id, total_labels: total, deducted: !!deductStock });
});

app.get('/api/print-jobs', async (_req, res) => {
  const jobs = await db.printJobs.find({}).sort({ created_at: -1 }).limit(20);
  res.json(jobs);
});

// ── Printers ─────────────────────────────────────────────────────────────────
app.get('/api/printers', async (_req, res) => {
  if (!getPrinters) return res.json([]);
  try {
    const printers = await getPrinters();
    res.json(printers);
  } catch (e) {
    res.json([]);
  }
});

// ── Direct Print (server-side PDF → thermal printer) ─────────────────────────
app.post('/api/print-direct', async (req, res) => {
  if (!printPDF) return res.status(503).json({ error: 'Direct printing is only available when running locally on Windows. Use "Print via Browser" instead.' });
  const { items, printerName, deductStock: shouldDeduct, labelSize = '50mm 25mm' } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'items required' });
  if (!printerName)   return res.status(400).json({ error: 'printerName required' });

  const MM    = 72 / 25.4;
  const m     = labelSize.match(/^(\d+(?:\.\d+)?)mm\s+(\d+(?:\.\d+)?)mm$/);
  const lblW  = m ? parseFloat(m[1]) : 50;
  const lblH  = m ? parseFloat(m[2]) : 25;
  const pageW = lblW * MM;
  const pageH = lblH * MM;

  const labels = [];
  for (const item of items) {
    const p = await db.products.findOne({ _id: item.productId });
    if (p) for (let i = 0; i < (item.qty || 1); i++) labels.push(p);
  }
  if (!labels.length) return res.status(400).json({ error: 'No products found' });

  const doc    = new PDFDocument({ size: [pageW, pageH], margin: 0, autoFirstPage: false });
  const chunks = [];
  doc.on('data', c => chunks.push(c));

  const xPad = 3;
  const cW   = pageW - xPad * 2;

  for (const p of labels) {
    doc.addPage({ size: [pageW, pageH], margin: 0 });

    let barcodeImg = null;
    try {
      barcodeImg = await bwipjs.toBuffer({
        bcid: 'code128',
        text: (p.serial_no || p.sku).replace(/[^\x20-\x7E]/g, ''),
        scale: 3, height: 8, includetext: false, backgroundcolor: 'ffffff',
      });
    } catch (_) {}

    const header  = (p.brand ? `${p.brand}:${p.name}` : p.name).toUpperCase().slice(0, 55);
    const detail  = [p.color, p.size, p.model_no].filter(Boolean).join(' · ').slice(0, 55);
    const mrpLine = `MRP:${Number(p.mrp).toFixed(2)}` +
      (p.selling_price && p.selling_price < p.mrp ? `  SP:${Number(p.selling_price).toFixed(2)}` : '');
    const serial  = (p.serial_no || p.sku).slice(0, 45);

    let y = 3;

    doc.font('Helvetica-Bold').fontSize(6);
    doc.text(header, xPad, y, { width: cW, align: 'center', lineBreak: false, ellipsis: true });
    y += 8;

    if (detail) {
      doc.font('Helvetica').fontSize(4.5);
      doc.text(detail, xPad, y, { width: cW, align: 'center', lineBreak: false, ellipsis: true });
      y += 6;
    }

    doc.font('Helvetica-Bold').fontSize(6);
    doc.text(mrpLine, xPad, y, { width: cW, align: 'center', lineBreak: false, ellipsis: true });
    y += 8;

    if (barcodeImg) {
      const bH = Math.max(8, Math.min(pageH - y - 8, 26));
      doc.image(barcodeImg, xPad, y, { width: cW, height: bH });
      y += bH + 1.5;
    }

    doc.font('Courier').fontSize(4);
    doc.text(serial, xPad, y, { width: cW, align: 'center', lineBreak: false, ellipsis: true });
  }

  const pdfBuf = await new Promise((resolve, reject) => {
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });

  const tmpFile = path.join(os.tmpdir(), `labels_${uuidv4()}.pdf`);
  fs.writeFileSync(tmpFile, pdfBuf);

  try {
    await printPDF(tmpFile, { printer: printerName, silent: true });
    setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch (_) {} }, 8000);

    const jobId = uuidv4();
    await db.printJobs.insert({
      _id: jobId, total_labels: labels.length, job_data: items,
      deduct_stock: !!shouldDeduct, created_at: new Date().toISOString(),
    });

    if (shouldDeduct) {
      for (const item of items) {
        const p = await db.products.findOne({ _id: item.productId });
        if (p) await db.products.update(
          { _id: item.productId },
          { $set: { stock: Math.max(0, (p.stock || 0) - (item.qty || 1)) } }
        );
      }
    }

    res.json({ success: true, labels: labels.length, printer: printerName });
  } catch (e) {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
    res.status(500).json({ error: 'Print failed: ' + e.message });
  }
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', async (_req, res) => {
  const total    = await db.products.count({});
  const cats     = await db.categories.count({});
  const jobs     = await db.printJobs.count({});
  const allJobs  = await db.printJobs.find({});
  const labels   = allJobs.reduce((s, j) => s + (j.total_labels || 0), 0);
  const allCats  = await db.categories.find({});
  const byCat    = await Promise.all(allCats.map(async c => ({
    name: c.name, icon: c.icon, count: await db.products.count({ category_id: c._id }),
  })));
  const lowStockCount    = await db.products.count({ stock: { $lte: 5 } });
  const lowStockProducts = await db.products.find({ stock: { $lte: 5 } }).sort({ stock: 1 }).limit(8);
  const catMap = {};
  allCats.forEach(c => { catMap[c._id] = c; });
  const lowStockEnriched = lowStockProducts.map(p => ({
    ...p, id: p._id,
    category_name: catMap[p.category_id]?.name || '',
    category_icon: catMap[p.category_id]?.icon || '',
  }));
  res.json({
    total, cats, jobs, labels,
    lowStockCount, lowStockProducts: lowStockEnriched,
    byCat: byCat.sort((a, b) => b.count - a.count),
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateSKU(catId, serialNo) {
  const m = {
    cat_mob: 'MOB', cat_acc: 'ACC', cat_tv: 'TV',  cat_ref: 'REF',
    cat_wm:  'WM',  cat_ac:  'AC',  cat_kit: 'KIT', cat_furn: 'FURN',
    cat_lap: 'LAP', cat_audio: 'AUD', cat_cam: 'CAM', cat_other: 'ELC',
  };
  const cat      = m[catId] || 'GEN';
  const datePart = serialNo.slice(0, 8);
  const seqPart  = serialNo.slice(8);
  return `${cat}-${datePart}-${seqPart}`;
}

async function generateSerialNo() {
  const d     = new Date();
  const year  = d.getFullYear().toString();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  const datePart   = `${year}${month}${day}`;
  const todayStart = `${year}-${month}-${day}T00:00:00.000Z`;
  const todayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
  const todayCount = await db.products.count({ created_at: { $gte: todayStart, $lt: todayEnd } });
  return `${datePart}${String(todayCount + 1).padStart(3, '0')}`;
}

// ── Boot ──────────────────────────────────────────────────────────────────────
seed().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🏪  RetailTag Pro  →  http://localhost:${PORT}`);
    console.log(`📦  Data           →  ${dataDir}\n`);
  });
}).catch(console.error);
