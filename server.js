require('dotenv').config();
// Force IPv4 DNS — fixes querySrv ECONNREFUSED on Windows with mongodb+srv://
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express     = require('express');
const path        = require('path');
const fs          = require('fs');
const os          = require('os');
const cors        = require('cors');
const mongoose    = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const bwipjs      = require('bwip-js');
const PDFDocument = require('pdfkit');

// pdf-to-printer bundles a Windows-only binary — load only on Windows.
let printPDF, getPrinters;
if (process.platform === 'win32') {
  try { ({ print: printPDF, getPrinters } = require('pdf-to-printer')); } catch (_) {}
}

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Mongoose Schemas ───────────────────────────────────────────────────────────
const S = mongoose.Schema;

const Category = mongoose.model('Category', new S(
  { _id: { type: String }, name: String, icon: String },
  { versionKey: false }
));

const Product = mongoose.model('Product', new S({
  _id:           { type: String, default: () => uuidv4() },
  serial_no:     { type: String, index: true },
  sku:           { type: String, index: true },
  name:          { type: String, required: true },
  brand:         { type: String, default: '' },
  category_id:   { type: String, default: 'cat_other' },
  mrp:           Number,
  selling_price: Number,
  model_no:      { type: String, default: '' },
  color:         { type: String, default: '' },
  size:          { type: String, default: '' },
  stock:         { type: Number, default: 0 },
  gst_rate:      { type: Number, default: 18 },
  hsn_code:      { type: String, default: '' },
  description:   { type: String, default: '' },
  created_at:    { type: String, default: () => new Date().toISOString() },
}, { versionKey: false }));

const PrintJob = mongoose.model('PrintJob', new S({
  total_labels: Number,
  job_data:     Array,
  deduct_stock: Boolean,
  created_at:   { type: String, default: () => new Date().toISOString() },
}, { versionKey: false }));

// ── DB helpers (mirror NeDB API used throughout) ───────────────────────────────
const db = {
  categories: {
    find:     (q = {}) => Category.find(q).lean(),
    findOne:  (q)      => Category.findOne(q).lean(),
    count:    (q = {}) => Category.countDocuments(q),
    insert:   (docs)   => Array.isArray(docs) ? Category.insertMany(docs) : new Category(docs).save(),
  },
  products: {
    find:     (q = {}) => Product.find(q).lean(),
    findOne:  (q)      => Product.findOne(q).lean(),
    count:    (q = {}) => Product.countDocuments(q),
    insert:   (doc)    => new Product(doc).save().then(d => d.toObject()),
    update:   (q, upd) => Product.updateOne(q, upd),
    remove:   (q)      => Product.deleteOne(q),
  },
  printJobs: {
    find:     (q = {}) => PrintJob.find(q).lean(),
    count:    (q = {}) => PrintJob.countDocuments(q),
    insert:   (doc)    => new PrintJob(doc).save().then(d => d.toObject()),
  },
};

// ── Seed categories ────────────────────────────────────────────────────────────
async function seed() {
  const count = await db.categories.count({});
  if (count === 0) {
    await db.categories.insert([
      { _id: 'cat_mob',   name: 'Mobiles',            icon: '📱' },
      { _id: 'cat_acc',   name: 'Mobile Accessories', icon: '🔌' },
      { _id: 'cat_tv',    name: 'Televisions',        icon: '📺' },
      { _id: 'cat_ref',   name: 'Refrigerators',      icon: '🧊' },
      { _id: 'cat_wm',    name: 'Washing Machines',   icon: '🫧' },
      { _id: 'cat_ac',    name: 'Air Conditioners',   icon: '❄️' },
      { _id: 'cat_kit',   name: 'Kitchen Appliances', icon: '🍳' },
      { _id: 'cat_furn',  name: 'Furniture',          icon: '🪑' },
      { _id: 'cat_lap',   name: 'Laptops & Computers',icon: '💻' },
      { _id: 'cat_audio', name: 'Audio & Headphones', icon: '🎧' },
      { _id: 'cat_cam',   name: 'Cameras',            icon: '📷' },
      { _id: 'cat_other', name: 'Other Electronics',  icon: '⚡' },
    ]);
    console.log('Categories seeded');
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Categories ────────────────────────────────────────────────────────────────
app.get('/api/categories', async (_req, res) => {
  const cats = await Category.find({}).sort({ name: 1 }).lean();
  res.json(cats.map(c => ({ ...c, id: c._id })));
});

// ── Products ──────────────────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  const { category, search, page = 1, limit = 15, low_stock } = req.query;
  const query = {};
  if (category)       query.category_id = category;
  if (low_stock === '1') query.stock = { $lte: 5 };
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ name: rx }, { brand: rx }, { sku: rx }, { serial_no: rx }, { model_no: rx }];
  }
  const total    = await Product.countDocuments(query);
  const skip     = (parseInt(page) - 1) * parseInt(limit);
  const products = await Product.find(query).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit)).lean();
  const cats     = await Category.find({}).lean();
  const catMap   = Object.fromEntries(cats.map(c => [c._id, c]));
  const enriched = products.map(p => ({
    ...p, id: p._id,
    category_name: catMap[p.category_id]?.name || '',
    category_icon: catMap[p.category_id]?.icon || '',
  }));
  res.json({ products: enriched, total, page: parseInt(page), limit: parseInt(limit) });
});

app.get('/api/products/:id', async (req, res) => {
  const p = await Product.findOne({ _id: req.params.id }).lean();
  if (!p) return res.status(404).json({ error: 'Not found' });
  const cat = await Category.findOne({ _id: p.category_id }).lean();
  res.json({ ...p, id: p._id, category_name: cat?.name || '', category_icon: cat?.icon || '' });
});

app.post('/api/products', async (req, res) => {
  const {
    name, brand, serial_no, sku, category_id,
    mrp, selling_price, model_no, color, size,
    stock, gst_rate, hsn_code, description,
  } = req.body;
  if (!name || !mrp)    return res.status(400).json({ error: 'name and mrp required' });
  if (!serial_no)       return res.status(400).json({ error: 'Serial No. is required' });
  if (!sku)             return res.status(400).json({ error: 'SKU is required' });

  const dup = await Product.findOne({ $or: [{ serial_no }, { sku }] }).lean();
  if (dup) return res.status(409).json({
    error: dup.serial_no === serial_no
      ? `Serial No. "${serial_no}" already exists`
      : `SKU "${sku}" already exists`,
  });

  const doc = await new Product({
    _id: uuidv4(), serial_no, sku,
    name, brand: brand || '',
    category_id: category_id || 'cat_other',
    mrp: parseFloat(mrp), selling_price: parseFloat(selling_price || mrp),
    model_no: model_no || '', color: color || '', size: size || '',
    stock: parseInt(stock || 0), gst_rate: parseFloat(gst_rate || 18),
    hsn_code: hsn_code || '', description: description || '',
    created_at: new Date().toISOString(),
  }).save();
  res.json({ ...doc.toObject(), id: doc._id });
});

app.put('/api/products/:id', async (req, res) => {
  const {
    name, brand, serial_no, sku, category_id,
    mrp, selling_price, model_no, color, size,
    stock, gst_rate, hsn_code, description,
  } = req.body;
  await Product.updateOne({ _id: req.params.id }, {
    $set: {
      name, brand, serial_no, sku, category_id,
      mrp: parseFloat(mrp), selling_price: parseFloat(selling_price || mrp),
      model_no: model_no || '', color: color || '', size: size || '',
      stock: parseInt(stock || 0), gst_rate: parseFloat(gst_rate || 18),
      hsn_code: hsn_code || '', description: description || '',
    },
  });
  const p = await Product.findOne({ _id: req.params.id }).lean();
  res.json({ ...p, id: p._id });
});

app.delete('/api/products/:id', async (req, res) => {
  await Product.deleteOne({ _id: req.params.id });
  res.json({ success: true });
});

// ── Stock Adjustment ──────────────────────────────────────────────────────────
app.patch('/api/products/:id/stock', async (req, res) => {
  const { delta, stock } = req.body;
  const p = await Product.findOne({ _id: req.params.id }).lean();
  if (!p) return res.status(404).json({ error: 'Not found' });
  const newStock = stock !== undefined
    ? Math.max(0, parseInt(stock))
    : Math.max(0, (p.stock || 0) + parseInt(delta || 0));
  await Product.updateOne({ _id: req.params.id }, { $set: { stock: newStock } });
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
  if (!items?.length) return res.status(400).json({ error: 'items required' });
  const total = items.reduce((s, i) => s + (i.qty || 1), 0);
  if (deductStock) {
    for (const item of items) {
      const p = await Product.findOne({ _id: item.productId }).lean();
      if (p) {
        const ns = Math.max(0, (p.stock || 0) - (item.qty || 1));
        await Product.updateOne({ _id: item.productId }, { $set: { stock: ns } });
      }
    }
  }
  const job = await new PrintJob({
    total_labels: total, job_data: items,
    deduct_stock: !!deductStock, created_at: new Date().toISOString(),
  }).save();
  res.json({ id: job._id, total_labels: total, deducted: !!deductStock });
});

app.get('/api/print-jobs', async (_req, res) => {
  const jobs = await PrintJob.find({}).sort({ created_at: -1 }).limit(20).lean();
  res.json(jobs);
});

// ── Printers ──────────────────────────────────────────────────────────────────
app.get('/api/printers', async (_req, res) => {
  if (!getPrinters) return res.json([]);
  try { res.json(await getPrinters()); } catch (_) { res.json([]); }
});

// ── Direct Print (server-side PDF → thermal printer) ─────────────────────────
app.post('/api/print-direct', async (req, res) => {
  if (!printPDF) return res.status(503).json({ error: 'Direct printing only available on local Windows server. Use Print via Browser.' });
  const { items, printerName, deductStock: shouldDeduct, labelSize = '50mm 25mm' } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'items required' });
  if (!printerName)   return res.status(400).json({ error: 'printerName required' });

  const MM = 72 / 25.4;
  const m  = labelSize.match(/^(\d+(?:\.\d+)?)mm\s+(\d+(?:\.\d+)?)mm$/);
  const pageW = (m ? parseFloat(m[1]) : 50) * MM;
  const pageH = (m ? parseFloat(m[2]) : 25) * MM;

  const labels = [];
  for (const item of items) {
    const p = await Product.findOne({ _id: item.productId }).lean();
    if (p) for (let i = 0; i < (item.qty || 1); i++) labels.push(p);
  }
  if (!labels.length) return res.status(400).json({ error: 'No products found' });

  const doc = new PDFDocument({ size: [pageW, pageH], margin: 0, autoFirstPage: false });
  const chunks = [];
  doc.on('data', c => chunks.push(c));

  for (const p of labels) {
    doc.addPage({ size: [pageW, pageH], margin: 0 });
    let barcodeImg = null;
    try {
      barcodeImg = await bwipjs.toBuffer({
        bcid: 'code128', text: (p.serial_no || p.sku).replace(/[^\x20-\x7E]/g, ''),
        scale: 3, height: 8, includetext: false, backgroundcolor: 'ffffff',
      });
    } catch (_) {}

    const xPad = 3, cW = pageW - xPad * 2;
    const header  = p.name.toUpperCase().slice(0, 55);
    const detail  = [p.color, p.size, p.model_no].filter(Boolean).join(' · ').slice(0, 55);
    const mrpLine = `MRP:${Number(p.mrp).toFixed(2)}` +
      (p.selling_price && p.selling_price < p.mrp ? `  SP:${Number(p.selling_price).toFixed(2)}` : '');
    const serial  = (p.serial_no || p.sku).slice(0, 45);

    let y = 3;
    doc.font('Helvetica-Bold').fontSize(6);
    doc.text(header, xPad, y, { width: cW, align: 'center', lineBreak: false, ellipsis: true }); y += 8;
    if (detail) {
      doc.font('Helvetica').fontSize(4.5);
      doc.text(detail, xPad, y, { width: cW, align: 'center', lineBreak: false, ellipsis: true }); y += 6;
    }
    doc.font('Helvetica-Bold').fontSize(6);
    doc.text(mrpLine, xPad, y, { width: cW, align: 'center', lineBreak: false, ellipsis: true }); y += 8;
    if (barcodeImg) {
      const bH = Math.max(8, Math.min(pageH - y - 8, 22));
      doc.image(barcodeImg, xPad, y, { width: cW, height: bH }); y += bH + 1.5;
    }
    doc.font('Courier').fontSize(4);
    doc.text(serial, xPad, y, { width: cW, align: 'center', lineBreak: false, ellipsis: true });
  }

  const pdfBuf = await new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });

  const tmpFile = path.join(os.tmpdir(), `labels_${uuidv4()}.pdf`);
  fs.writeFileSync(tmpFile, pdfBuf);
  try {
    await printPDF(tmpFile, { printer: printerName, silent: true });
    setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch (_) {} }, 8000);
    const job = await new PrintJob({
      total_labels: labels.length, job_data: items,
      deduct_stock: !!shouldDeduct, created_at: new Date().toISOString(),
    }).save();
    if (shouldDeduct) {
      for (const item of items) {
        const p = await Product.findOne({ _id: item.productId }).lean();
        if (p) await Product.updateOne({ _id: item.productId },
          { $set: { stock: Math.max(0, (p.stock || 0) - (item.qty || 1)) } });
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
  const [total, cats, jobs, allJobs, allCats] = await Promise.all([
    Product.countDocuments({}),
    Category.countDocuments({}),
    PrintJob.countDocuments({}),
    PrintJob.find({}).lean(),
    Category.find({}).lean(),
  ]);
  const labels   = allJobs.reduce((s, j) => s + (j.total_labels || 0), 0);
  const catMap   = Object.fromEntries(allCats.map(c => [c._id, c]));
  const byCat    = await Promise.all(allCats.map(async c => ({
    name: c.name, icon: c.icon,
    count: await Product.countDocuments({ category_id: c._id }),
  })));
  const lowStockCount    = await Product.countDocuments({ stock: { $lte: 5 } });
  const lowStockProducts = await Product.find({ stock: { $lte: 5 } }).sort({ stock: 1 }).limit(8).lean();
  const lowStockEnriched = lowStockProducts.map(p => ({
    ...p, id: p._id,
    category_name: catMap[p.category_id]?.name || '',
    category_icon: catMap[p.category_id]?.icon || '',
  }));
  res.json({
    total, cats, jobs, labels, lowStockCount,
    lowStockProducts: lowStockEnriched,
    byCat: byCat.sort((a, b) => b.count - a.count),
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function start() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('✅  MongoDB connected');
  await seed();
  app.listen(PORT, () => {
    console.log(`\n🏷️   PMTAG  →  http://localhost:${PORT}\n`);
  });
}

start().catch(err => {
  console.error('\n❌  Startup failed:', err.message);
  if (err.message.includes('querySrv') || err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND') || err.message.includes('connect')) {
    console.error('\n🔧  MongoDB Atlas connection checklist:');
    console.error('   1. Network Access → Add your IP (or 0.0.0.0/0 for dev):');
    console.error('      https://cloud.mongodb.com → Security → Network Access');
    console.error('   2. Check your cluster is not paused (free tier pauses after inactivity)');
    console.error('   3. Verify MONGODB_URI in your .env file\n');
  }
  process.exit(1);
});
