// ─── SVG Icon Library ────────────────────────────────────────────────────────
const ICONS = {
  box:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  alert:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  printer: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
  tag:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
  eye:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  pencil:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  prt:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
  trash:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  restock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
};

// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  categories: [],
  products: [],
  queue: [],          // [{ product, qty }]
  currentPage: 1,
  totalProducts: 0,
  activePage: 'dashboard',
  previewDirty: false,
};
const API = '';
const LIMIT = 15;

// ─── Init ────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();
  await loadDashboard();
  setupNavListeners();
});

function setupNavListeners() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); goPage(el.dataset.page); });
  });
}

function goPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');
  const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (nav) nav.classList.add('active');
  state.activePage = page;
  if (page === 'dashboard') loadDashboard();
  if (page === 'products') loadProducts();
  if (page === 'print') { renderQueue(); clearQueueSearch(); }
  if (page === 'add-product') resetAddForm();
  closeSidebarIfMobile();
  window.scrollTo(0, 0);
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function closeSidebarIfMobile() {
  if (window.innerWidth < 900) document.getElementById('sidebar').classList.remove('open');
}

// ─── Categories ───────────────────────────────────────────────────────────────
async function loadCategories() {
  state.categories = await apiFetch('/api/categories');
  const catSelect = document.getElementById('f-cat');
  catSelect.innerHTML = state.categories.map(c =>
    `<option value="${c.id}">${c.icon} ${c.name}</option>`
  ).join('');
  const catFilter = document.getElementById('catFilter');
  catFilter.innerHTML = '<option value="">All Categories</option>' +
    state.categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  const sidebar = document.getElementById('sidebarCats');
  sidebar.innerHTML = `<div class="cats-title">Browse by Category</div>` +
    state.categories.map(c =>
      `<div class="cat-item" onclick="filterByCategory('${c.id}')">${c.icon} ${escHtml(c.name)}</div>`
    ).join('');
}

function filterByCategory(catId) {
  state.currentPage = 1;
  document.getElementById('catFilter').value = catId;
  goPage('products');
  loadProducts();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const [stats, jobs] = await Promise.all([
    apiFetch('/api/stats'),
    apiFetch('/api/print-jobs'),
  ]);

  // Stats cards
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card sc-blue">
      <div class="sc-icon">${ICONS.box}</div>
      <div class="sv">${stats.total}</div>
      <div class="sl">Total Products</div>
    </div>
    <div class="stat-card ${stats.lowStockCount > 0 ? 'sc-red' : 'sc-orange'}">
      <div class="sc-icon">${ICONS.alert}</div>
      <div class="sv">${stats.lowStockCount}</div>
      <div class="sl">Low / Out of Stock</div>
    </div>
    <div class="stat-card sc-green">
      <div class="sc-icon">${ICONS.printer}</div>
      <div class="sv">${stats.jobs}</div>
      <div class="sl">Print Jobs</div>
    </div>
    <div class="stat-card sc-purple">
      <div class="sc-icon">${ICONS.tag}</div>
      <div class="sv">${stats.labels}</div>
      <div class="sl">Labels Printed</div>
    </div>
  `;

  // Category chart
  const max = Math.max(...stats.byCat.map(c => c.count), 1);
  document.getElementById('catChart').innerHTML = stats.byCat.filter(c => c.count > 0).map(c => `
    <div class="cat-bar-row">
      <div class="cat-bar-label">${c.icon} ${escHtml(c.name)}</div>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(c.count / max * 100).toFixed(0)}%"></div></div>
      <div class="cat-bar-num">${c.count}</div>
    </div>
  `).join('') || '<div class="empty-msg">No products yet.</div>';

  // Low stock section
  const lsCard = document.getElementById('lowStockCard');
  const lsList = document.getElementById('lowStockList');
  const lsBadge = document.getElementById('lowStockBadge');
  if (stats.lowStockCount > 0) {
    lsCard.style.display = '';
    lsBadge.textContent = stats.lowStockCount;
    lsList.innerHTML = stats.lowStockProducts.map(p => {
      const cls = p.stock === 0 ? 'zero' : 'low';
      const label = p.stock === 0 ? 'Out of Stock' : `${p.stock} left`;
      return `
        <div class="ls-item">
          <div class="ls-info">
            <div class="ls-name">${escHtml(p.name)}</div>
            <div class="ls-meta">${p.category_icon || ''} ${escHtml(p.category_name || '')} · ${escHtml(p.sku)}</div>
          </div>
          <div class="ls-right">
            <span class="ls-stock ${cls}">${label}</span>
            <button class="ls-restock-btn" onclick="openStockModal('${p.id}', ${p.stock}, '${escHtml(p.name).replace(/'/g, "\\'")}')">
              ${ICONS.restock} Restock
            </button>
          </div>
        </div>
      `;
    }).join('');
  } else {
    lsCard.style.display = 'none';
  }

  // Print history
  const ph = document.getElementById('printHistory');
  if (jobs.length) {
    ph.innerHTML = jobs.slice(0, 8).map(j => {
      const d = new Date(j.created_at);
      const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="print-job-row">
          <div>
            <span class="pj-labels">${j.total_labels} label${j.total_labels !== 1 ? 's' : ''}</span>
            ${j.deduct_stock ? '<span class="pj-deducted"> · stock deducted</span>' : ''}
          </div>
          <span class="pj-time">${dateStr}, ${timeStr}</span>
        </div>
      `;
    }).join('');
  } else {
    ph.innerHTML = '<div class="empty-msg" style="padding:16px 0">No print jobs yet.</div>';
  }
}

function viewLowStock() {
  state.currentPage = 1;
  document.getElementById('catFilter').value = '';
  document.getElementById('prodSearch').value = '';
  goPage('products');
  apiFetch(`/api/products?low_stock=1&limit=${LIMIT}`).then(data => {
    state.products = data.products;
    state.totalProducts = data.total;
    renderProductTable();
    renderPagination(data.total, data.page, data.limit);
    const fc = document.getElementById('filterCount');
    if (fc) fc.textContent = `${data.total} low stock item${data.total !== 1 ? 's' : ''}`;
  });
}

// ─── Products ─────────────────────────────────────────────────────────────────
let filterTimer;
function filterChanged() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => { state.currentPage = 1; loadProducts(); }, 280);
}

async function loadProducts() {
  const search = document.getElementById('prodSearch').value;
  const cat = document.getElementById('catFilter').value;
  const data = await apiFetch(
    `/api/products?search=${encodeURIComponent(search)}&category=${cat}&page=${state.currentPage}&limit=${LIMIT}`
  );
  state.products = data.products;
  state.totalProducts = data.total;
  renderProductTable();
  renderPagination(data.total, data.page, data.limit);
  const fc = document.getElementById('filterCount');
  if (fc) fc.textContent = data.total ? `${data.total} product${data.total !== 1 ? 's' : ''}` : '';
}

function renderProductTable() {
  const tbody = document.getElementById('prodTableBody');
  if (!state.products.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:48px;font-size:13px">
      No products found. <a href="#" onclick="goPage('add-product');return false;" style="color:var(--accent);font-weight:600">Add your first product →</a>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = state.products.map(p => {
    const hasDiscount = p.selling_price && p.selling_price < p.mrp;
    const detail = [p.color, p.size].filter(Boolean).join(' · ');
    const stockCls = p.stock === 0 ? 'stock-low' : p.stock <= 5 ? 'stock-low' : 'stock-ok';
    const stockLabel = p.stock === 0 ? 'Out' : p.stock <= 5 ? `${p.stock} ⚠` : String(p.stock);
    return `
      <tr>
        <td>
          <div class="prod-name">${escHtml(p.name)}</div>
          <div class="prod-meta">${escHtml(p.brand || '')}${p.model_no ? ' <span class="prod-model-dot">·</span> ' + escHtml(p.model_no) : ''}</div>
          ${detail ? `<div class="prod-detail">${escHtml(detail)}</div>` : ''}
        </td>
        <td><span class="cat-pill">${p.category_icon || ''} ${escHtml(p.category_name || '')}</span></td>
        <td>
          <div class="sku-code">${escHtml(p.sku)}</div>
          ${p.serial_no ? `<div class="serial-num">${escHtml(p.serial_no)}</div>` : ''}
        </td>
        <td>
          <div class="mrp-val">₹${Number(p.mrp).toLocaleString('en-IN')}</div>
          ${hasDiscount ? `<div class="sp-val">₹${Number(p.selling_price).toLocaleString('en-IN')} offer</div>` : ''}
        </td>
        <td>
          <div class="stock-ctrl">
            <button class="stk-btn minus" onclick="adjustStock('${p.id}', -1)" title="Reduce">−</button>
            <span class="stock-badge ${stockCls}" style="cursor:pointer;min-width:52px;justify-content:center"
              onclick="openStockModal('${p.id}', ${p.stock}, '${escHtml(p.name).replace(/'/g, "\\'")}')"
              title="Click to update stock">${stockLabel}</span>
            <button class="stk-btn" onclick="adjustStock('${p.id}', 1)" title="Increase">+</button>
          </div>
        </td>
        <td>
          <div class="action-btns">
            <button class="bir" onclick="viewProduct('${p.id}')" title="View details">${ICONS.eye}</button>
            <button class="bir edit" onclick="editProduct('${p.id}')" title="Edit product">${ICONS.pencil}</button>
            <button class="bir queue" onclick="addToQueue('${p.id}')" title="Add to print queue">${ICONS.prt}</button>
            <button class="bir del" onclick="deleteProduct('${p.id}')" title="Delete product">${ICONS.trash}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderPagination(total, page, limit) {
  const pages = Math.ceil(total / limit);
  const el = document.getElementById('pagination');
  if (pages <= 1) { el.innerHTML = ''; return; }
  let html = '';
  if (page > 1) html += `<button class="page-btn" onclick="changePage(${page - 1})">← Prev</button>`;
  for (let n = Math.max(1, page - 2); n <= Math.min(pages, page + 2); n++) {
    html += `<button class="page-btn ${n === page ? 'active' : ''}" onclick="changePage(${n})">${n}</button>`;
  }
  if (page < pages) html += `<button class="page-btn" onclick="changePage(${page + 1})">Next →</button>`;
  html += `<span class="page-info">${total} total</span>`;
  el.innerHTML = html;
}

function changePage(n) {
  state.currentPage = n;
  loadProducts();
  window.scrollTo(0, 0);
}

// ─── Stock Management ─────────────────────────────────────────────────────────
async function adjustStock(productId, delta) {
  try {
    const result = await apiFetch(`/api/products/${productId}/stock`, 'PATCH', { delta });
    // Update local state
    const p = state.products.find(x => x.id === productId);
    if (p) { p.stock = result.stock; renderProductTable(); }
    const label = delta > 0 ? `+${delta}` : `${delta}`;
    showToast(`Stock updated to ${result.stock} (${label})`, 'success');
  } catch (e) {
    showToast('Failed to update stock', 'error');
  }
}

// Stock modal
let stockModalProduct = null;
function openStockModal(productId, currentStock, name) {
  stockModalProduct = productId;
  document.getElementById('stockModalId').value = productId;
  document.getElementById('stockModalCurrent').textContent = currentStock;
  document.getElementById('stockModalName').textContent = name;
  document.getElementById('stockModalTitle').textContent = 'Update Stock';
  document.getElementById('stockModalVal').value = currentStock;
  document.getElementById('stockModal').classList.add('open');
  setTimeout(() => document.getElementById('stockModalVal').select(), 100);
}
function closeStockModal() {
  document.getElementById('stockModal').classList.remove('open');
  stockModalProduct = null;
}
function stockModalAdj(delta) {
  const inp = document.getElementById('stockModalVal');
  inp.value = Math.max(0, (parseInt(inp.value) || 0) + delta);
}
function stockModalSet(val) {
  document.getElementById('stockModalVal').value = val;
}
async function saveStockModal() {
  const id = document.getElementById('stockModalId').value;
  const stock = parseInt(document.getElementById('stockModalVal').value) || 0;
  try {
    const result = await apiFetch(`/api/products/${id}/stock`, 'PATCH', { stock });
    const p = state.products.find(x => x.id === id);
    if (p) { p.stock = result.stock; renderProductTable(); }
    showToast(`Stock set to ${result.stock} units`, 'success');
    closeStockModal();
    if (state.activePage === 'dashboard') loadDashboard();
  } catch (e) {
    showToast('Failed to update stock', 'error');
  }
}

// ─── Add / Edit Product ───────────────────────────────────────────────────────
function resetAddForm() {
  document.getElementById('formTitle').textContent = 'Add Product';
  document.getElementById('formSubtitle').textContent = 'Fill in the details — Serial No. & SKU are auto-generated on save';
  document.getElementById('editId').value = '';
  document.getElementById('identifiersCard').style.display = 'none';
  document.getElementById('btnAddAnother').style.display = '';
  clearForm();
}

async function saveProduct() {
  const body = collectForm();
  if (!body) return;
  const id = document.getElementById('editId').value;
  try {
    if (id) {
      await apiFetch(`/api/products/${id}`, 'PUT', body);
      showToast('Product updated successfully!', 'success');
      clearForm();
      goPage('products');
    } else {
      const saved = await apiFetch('/api/products', 'POST', body);
      // Auto-add new product straight to print queue
      state.queue.push({ product: saved, qty: 1 });
      state.previewDirty = true;
      updateQueueBadge();
      showToast(`"${saved.name}" saved & added to print queue`, 'success');
      clearForm();
      goPage('print');
    }
  } catch (e) {
    showToast('Failed to save product', 'error');
  }
}

async function saveAndAddAnother() {
  const body = collectForm();
  if (!body) return;
  try {
    const saved = await apiFetch('/api/products', 'POST', body);
    // Also add to print queue
    state.queue.push({ product: saved, qty: 1 });
    state.previewDirty = true;
    updateQueueBadge();
    showToast(`✓ Saved & queued: ${saved.name}`, 'success');
    clearForm();
    document.getElementById('f-name').focus();
  } catch (e) {
    showToast('Failed to save product', 'error');
  }
}

function collectForm() {
  let valid = true;
  const name = document.getElementById('f-name').value.trim();
  const brand = document.getElementById('f-brand').value.trim();
  const mrpRaw = document.getElementById('f-mrp').value;
  const mrp = parseFloat(mrpRaw);

  if (!name) {
    setFieldError('row-name', 'err-name', 'Product name is required');
    valid = false;
  }
  if (!brand) {
    setFieldError('row-brand', 'err-brand', 'Brand is required');
    valid = false;
  }
  if (!mrpRaw || isNaN(mrp) || mrp <= 0) {
    setFieldError('row-mrp', 'err-mrp', 'Enter a valid MRP greater than 0');
    valid = false;
  }
  if (!valid) return null;

  const spRaw = parseFloat(document.getElementById('f-price').value);
  const sellingPrice = (!isNaN(spRaw) && spRaw > 0) ? spRaw : mrp;

  return {
    name, brand,
    category_id: document.getElementById('f-cat').value,
    mrp, selling_price: sellingPrice,
    model_no: document.getElementById('f-model').value.trim(),
    color: document.getElementById('f-color').value.trim(),
    size: document.getElementById('f-size').value.trim(),
    stock: parseInt(document.getElementById('f-stock').value) || 0,
    gst_rate: parseFloat(document.getElementById('f-gst').value),
    hsn_code: document.getElementById('f-hsn').value.trim(),
    description: document.getElementById('f-desc').value.trim(),
  };
}

function setFieldError(rowId, errId, msg) {
  document.getElementById(rowId).classList.add('has-error');
  const err = document.getElementById(errId);
  if (err) err.textContent = msg;
  document.getElementById(rowId).querySelector('input,select,textarea')?.focus();
}

function clearFieldError(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.classList.remove('has-error');
  const err = row.querySelector('.field-error');
  if (err) err.textContent = '';
}

function updatePriceHint() {
  const mrp = parseFloat(document.getElementById('f-mrp').value) || 0;
  const sp = parseFloat(document.getElementById('f-price').value) || 0;
  const hint = document.getElementById('priceHint');
  if (!hint) return;
  if (sp > 0 && sp < mrp) {
    const disc = ((mrp - sp) / mrp * 100).toFixed(1);
    hint.textContent = `${disc}% discount off MRP`;
    hint.style.color = 'var(--success)';
  } else if (sp > mrp) {
    hint.textContent = 'Selling price exceeds MRP — please check';
    hint.style.color = 'var(--danger)';
  } else {
    hint.textContent = 'Leave blank to use MRP';
    hint.style.color = '';
  }
}

async function editProduct(id) {
  const p = await apiFetch(`/api/products/${id}`);
  document.getElementById('formTitle').textContent = 'Edit Product';
  document.getElementById('formSubtitle').textContent = `Editing: ${p.name}`;
  document.getElementById('editId').value = p.id;
  document.getElementById('f-name').value = p.name;
  document.getElementById('f-brand').value = p.brand || '';
  document.getElementById('f-cat').value = p.category_id;
  document.getElementById('f-mrp').value = p.mrp;
  document.getElementById('f-price').value = p.selling_price || p.mrp;
  document.getElementById('f-model').value = p.model_no || '';
  document.getElementById('f-color').value = p.color || '';
  document.getElementById('f-size').value = p.size || '';
  document.getElementById('f-stock').value = p.stock || 0;
  document.getElementById('f-gst').value = p.gst_rate || 18;
  document.getElementById('f-hsn').value = p.hsn_code || '';
  document.getElementById('f-desc').value = p.description || '';
  // Show identifiers
  document.getElementById('identifiersCard').style.display = '';
  document.getElementById('f-serial').value = p.serial_no || '—';
  document.getElementById('f-sku').value = p.sku || '';
  // Hide "Add Another" on edit
  document.getElementById('btnAddAnother').style.display = 'none';
  updatePriceHint();
  goPage('add-product');
}

function clearForm() {
  ['f-name', 'f-brand', 'f-model', 'f-color', 'f-size', 'f-desc', 'f-hsn', 'f-mrp', 'f-price', 'f-stock'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-gst').value = '18';
  document.getElementById('editId').value = '';
  ['row-name', 'row-brand', 'row-mrp'].forEach(id => clearFieldError(id));
  const hint = document.getElementById('priceHint');
  if (hint) { hint.textContent = 'Leave blank to use MRP'; hint.style.color = ''; }
}

async function deleteProduct(id) {
  const p = state.products.find(x => x.id === id);
  const name = p ? p.name : 'this product';
  if (!confirm(`Delete "${name}"?\n\nThis cannot be undone.`)) return;
  try {
    await apiFetch(`/api/products/${id}`, 'DELETE');
    showToast('Product deleted', 'success');
    state.queue = state.queue.filter(q => q.product.id !== id);
    updateQueueBadge();
    loadProducts();
  } catch (e) {
    showToast('Failed to delete product', 'error');
  }
}

// ─── Product Detail Modal ──────────────────────────────────────────────────────
async function viewProduct(id) {
  const p = await apiFetch(`/api/products/${id}`);
  document.getElementById('modalTitle').textContent = p.name;
  const rows = [
    ['Serial No.', p.serial_no || '—', 'mono'],
    ['SKU Code', p.sku, 'accent'],
    ['Brand', p.brand],
    ['Category', `${p.category_icon || ''} ${p.category_name || ''}`],
    ['Model No.', p.model_no],
    ['Color / Finish', p.color],
    ['Size / Variant', p.size],
    ['MRP', `₹${Number(p.mrp).toLocaleString('en-IN')}`, 'price'],
    ['Selling Price', p.selling_price && p.selling_price !== p.mrp
      ? `₹${Number(p.selling_price).toLocaleString('en-IN')}`
      : null],
    ['GST Rate', `${p.gst_rate}%`],
    ['HSN Code', p.hsn_code],
    ['Description', p.description],
  ];
  document.getElementById('modalBody').innerHTML = `
    <div class="modal-barcode">
      <img src="/api/qr/${encodeURIComponent(p.serial_no || p.sku)}?scale=5" alt="QR Code"
        style="width:110px;height:110px;image-rendering:pixelated;display:block;margin:0 auto 4px"
        onerror="this.style.display='none'" />
      <div class="modal-barcode-num" style="font-family:monospace;font-size:11px;color:#374151">${escHtml(p.serial_no || '—')}</div>
    </div>
    ${rows.filter(([, v]) => v).map(([k, v, cls]) =>
      `<div class="detail-row">
        <span class="dk">${k}</span>
        <span class="dv ${cls || ''}">${escHtml(String(v))}</span>
      </div>`
    ).join('')}
    <div class="stock-modal-section">
      <div class="stock-modal-title">Stock</div>
      <div class="stock-adj-row">
        <span class="stk-label">Current Stock</span>
        <button class="stk-big-btn" onclick="adjustStockModal('${p.id}',-1)">−</button>
        <input type="number" class="stk-input" id="modalStockVal" min="0" value="${p.stock}" />
        <button class="stk-big-btn" onclick="adjustStockModal('${p.id}',1)">+</button>
        <button class="btn-success" onclick="saveModalStock('${p.id}')" style="padding:6px 12px;font-size:12px">Save</button>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-primary" onclick="addToQueue('${p.id}');closeModal()">🛒 Add to Queue</button>
      <button class="btn-outline" onclick="editProduct('${p.id}');closeModal()">✏️ Edit</button>
    </div>
  `;
  document.getElementById('modal').classList.add('open');
}

function adjustStockModal(productId, delta) {
  const inp = document.getElementById('modalStockVal');
  if (!inp) return;
  inp.value = Math.max(0, (parseInt(inp.value) || 0) + delta);
}

async function saveModalStock(productId) {
  const stock = parseInt(document.getElementById('modalStockVal').value) || 0;
  try {
    const result = await apiFetch(`/api/products/${productId}/stock`, 'PATCH', { stock });
    const p = state.products.find(x => x.id === productId);
    if (p) { p.stock = result.stock; renderProductTable(); }
    showToast(`Stock updated to ${result.stock} units`, 'success');
    closeModal();
  } catch (e) {
    showToast('Failed to update stock', 'error');
  }
}

function closeModal() { document.getElementById('modal').classList.remove('open'); }

// ─── Print Queue ───────────────────────────────────────────────────────────────
async function addToQueue(productId) {
  const existing = state.queue.find(q => q.product.id === productId);
  if (existing) {
    existing.qty++;
    updateQueueBadge();
    renderQueue();
    state.previewDirty = true;
    showToast(`Qty updated — now ${existing.qty}×`, 'success');
    return;
  }
  const p = state.products.find(x => x.id === productId) || await apiFetch(`/api/products/${productId}`);
  state.queue.push({ product: p, qty: 1 });
  updateQueueBadge();
  renderQueue();
  state.previewDirty = true;
  showToast(`${p.name} added to queue`, 'success');
}

function removeFromQueue(productId) {
  state.queue = state.queue.filter(q => q.product.id !== productId);
  updateQueueBadge();
  renderQueue();
  state.previewDirty = true;
}

function changeQueueQty(productId, delta) {
  const item = state.queue.find(q => q.product.id === productId);
  if (item) {
    item.qty = Math.max(1, Math.min(999, item.qty + delta));
    updateQueueBadge();
    renderQueue();
    state.previewDirty = true;
  }
}

function setQueueQty(productId, val) {
  const item = state.queue.find(q => q.product.id === productId);
  if (item) {
    item.qty = Math.max(1, Math.min(999, parseInt(val) || 1));
    updateQueueBadge();
    renderQueueSummary();
    state.previewDirty = true;
  }
}

function updateQueueBadge() {
  const total = state.queue.reduce((s, q) => s + q.qty, 0);
  document.getElementById('queueBadge').textContent = `🛒 ${total} in queue`;
  const tag = document.getElementById('queueCount');
  if (tag) tag.textContent = `${state.queue.length} item${state.queue.length !== 1 ? 's' : ''}`;
}

function renderQueueSummary() {
  const totalLabels = state.queue.reduce((s, q) => s + q.qty, 0);
  const el = document.getElementById('queueSummary');
  if (!el) return;
  if (state.queue.length > 0) {
    el.style.display = '';
    document.getElementById('qsTotalProducts').textContent = state.queue.length;
    document.getElementById('qsTotalLabels').textContent = totalLabels;
  } else {
    el.style.display = 'none';
  }
}

function renderQueue() {
  const el = document.getElementById('queueList');
  if (!state.queue.length) {
    el.innerHTML = '<div class="queue-empty">No products in queue.<br>Use search above or go to Products page.</div>';
    renderQueueSummary();
    return;
  }
  el.innerHTML = state.queue.map(q => {
    const hasDiscount = q.product.selling_price && q.product.selling_price < q.product.mrp;
    const priceStr = hasDiscount
      ? `₹${Number(q.product.selling_price).toLocaleString('en-IN')} (MRP ₹${Number(q.product.mrp).toLocaleString('en-IN')})`
      : `₹${Number(q.product.mrp).toLocaleString('en-IN')}`;
    return `
      <div class="queue-item">
        <div class="qinfo">
          <div class="qname" title="${escHtml(q.product.name)}">${escHtml(q.product.name)}</div>
          <div class="qsku">${q.product.serial_no ? escHtml(q.product.serial_no) + ' · ' : ''}${escHtml(q.product.sku)}</div>
          <div class="qprice">${priceStr}</div>
        </div>
        <div class="qty-wrap">
          <button class="qty-btn2" onclick="changeQueueQty('${q.product.id}',-1)" title="Decrease">−</button>
          <input class="qty-num" type="number" value="${q.qty}" min="1" max="999"
            onchange="setQueueQty('${q.product.id}',this.value)" title="Quantity" />
          <button class="qty-btn2" onclick="changeQueueQty('${q.product.id}',1)" title="Increase">+</button>
          <button class="btn-danger-sm" onclick="removeFromQueue('${q.product.id}')" title="Remove from queue">✕</button>
        </div>
      </div>
    `;
  }).join('');
  updateQueueBadge();
  renderQueueSummary();
}

function clearQueue() {
  if (state.queue.length && !confirm('Clear the entire print queue?')) return;
  state.queue = [];
  state.previewDirty = false;
  updateQueueBadge();
  renderQueue();
  document.getElementById('labelPreview').innerHTML = '<div class="empty-msg">Queue cleared.</div>';
  const pc = document.getElementById('previewCount');
  if (pc) pc.textContent = '';
}

// ─── Quick Search (Print Page) ────────────────────────────────────────────────
let queueSearchTimer;
async function searchForQueue(term) {
  clearTimeout(queueSearchTimer);
  const results = document.getElementById('queueSearchResults');
  if (!term.trim()) { results.innerHTML = ''; return; }
  queueSearchTimer = setTimeout(async () => {
    const data = await apiFetch(`/api/products?search=${encodeURIComponent(term)}&limit=6`);
    if (!data.products.length) {
      results.innerHTML = `<div class="qsr-empty">No products found for "${escHtml(term)}"</div>`;
      return;
    }
    results.innerHTML = data.products.map(p => {
      const inQueue = state.queue.some(q => q.product.id === p.id);
      return `
        <div class="qsr-item" onclick="addToQueueFromSearch('${p.id}')">
          <div class="qsr-info">
            <div class="qsr-name">${escHtml(p.name)}</div>
            <div class="qsr-meta">${escHtml(p.sku)} · ₹${Number(p.mrp).toLocaleString('en-IN')} · Stock: ${p.stock}</div>
          </div>
          <span class="qsr-add">${inQueue ? '+ More' : '+ Add'}</span>
        </div>
      `;
    }).join('');
  }, 250);
}

async function addToQueueFromSearch(productId) {
  await addToQueue(productId);
  // Clear search
  document.getElementById('queueSearch').value = '';
  document.getElementById('queueSearchResults').innerHTML = '';
}

function clearQueueSearch() {
  const s = document.getElementById('queueSearch');
  if (s) s.value = '';
  const r = document.getElementById('queueSearchResults');
  if (r) r.innerHTML = '';
}

// ─── Label Preview & Print ────────────────────────────────────────────────────
let autoPreviewTimer;
function autoRefreshPreview() {
  if (!state.previewDirty && document.getElementById('labelPreview').children.length <= 1) return;
  clearTimeout(autoPreviewTimer);
  autoPreviewTimer = setTimeout(generatePreview, 600);
}

// Barcode height (bwip-js height param) and preview width mapped per paper size
const PAPER_SPECS = {
  '38mm 25mm': { barcodeH: 18, w: 38, h: 25 },
  '40mm 20mm': { barcodeH: 15, w: 40, h: 20 },
  '40mm 25mm': { barcodeH: 18, w: 40, h: 25 },
  '50mm 25mm': { barcodeH: 20, w: 50, h: 25 },
  '57mm 32mm': { barcodeH: 26, w: 57, h: 32 },
  'auto':      { barcodeH: 22, w: 57, h: 32 },
};

async function generatePreview() {
  if (!state.queue.length) { showToast('Print queue is empty', 'error'); return; }
  const cols    = document.getElementById('labelCols').value;
  const showMrp = document.getElementById('showMrp').value === '1';
  const showGst = document.getElementById('showGst').value === '1';
  const paperSize = document.getElementById('labelPaperSize')?.value || '38mm 25mm';
  const spec = PAPER_SPECS[paperSize] || PAPER_SPECS['38mm 25mm'];

  const preview = document.getElementById('labelPreview');
  const pc = document.getElementById('previewCount');
  preview.className = `label-preview-area cols-${cols}`;
  preview.innerHTML = '<div class="empty-msg" style="padding:24px">Generating labels…</div>';

  const labels = [];
  for (const item of state.queue) {
    for (let i = 0; i < item.qty; i++) labels.push(item.product);
  }

  // Preview width: show label at 4px per mm so it looks like the real label
  const previewW = spec.w * 4;
  const previewH = spec.h * 4;

  const labelsHtml = labels.map(p => {
    const detail = [p.color, p.size, p.model_no].filter(Boolean).join(' · ');
    const hasDiscount = p.selling_price && p.selling_price < p.mrp;

    // BRAND:PRODUCT NAME — Samsung format: colon, no space, all caps
    const header = p.brand
      ? `${p.brand.toUpperCase()}:${p.name.toUpperCase()}`
      : p.name.toUpperCase();

    // MRP:599.00 — colon style, 2 decimal places
    const mrpFmt = `MRP:${Number(p.mrp).toFixed(2)}`;
    const spFmt  = hasDiscount ? `  SP:${Number(p.selling_price).toFixed(2)}` : '';

    const barcodeCode = encodeURIComponent(p.serial_no || p.sku);
    // scale=3 → high-res PNG that thermal printer can render crisply
    const barcodeUrl = `/api/barcode/${barcodeCode}?scale=3&height=${spec.barcodeH}`;

    // Inline preview size mimics the actual label paper dimensions
    const labelStyle = `width:${previewW}px;min-height:${previewH}px;font-size:${Math.max(7, spec.w * 0.22)}px;`;

    return `
      <div class="lbl" style="${labelStyle}">
        <div class="l-header">${escHtml(header)}</div>
        ${detail ? `<div class="l-detail">${escHtml(detail)}</div>` : ''}
        ${showMrp ? `<div class="l-mrp-line">${escHtml(mrpFmt + spFmt)}</div>` : ''}
        <div class="l-barcode"><img src="${barcodeUrl}" alt="barcode" loading="lazy" /></div>
        <div class="l-serial">${escHtml(p.serial_no || p.sku)}</div>
        ${showMrp && showGst && p.gst_rate ? `<div class="l-inc">Incl. ${p.gst_rate}% GST${p.hsn_code ? ' · HSN ' + escHtml(p.hsn_code) : ''}</div>` : ''}
      </div>
    `;
  }).join('');

  preview.innerHTML = labelsHtml;

  // Populate printArea (used by window.print) — no inline size styles for print
  const printLabelsHtml = labels.map(p => {
    const detail = [p.color, p.size, p.model_no].filter(Boolean).join(' · ');
    const hasDiscount = p.selling_price && p.selling_price < p.mrp;
    const header = p.brand
      ? `${p.brand.toUpperCase()}:${p.name.toUpperCase()}`
      : p.name.toUpperCase();
    const mrpFmt = `MRP:${Number(p.mrp).toFixed(2)}`;
    const spFmt  = hasDiscount ? `  SP:${Number(p.selling_price).toFixed(2)}` : '';
    const barcodeCode = encodeURIComponent(p.serial_no || p.sku);
    const barcodeUrl = `/api/barcode/${barcodeCode}?scale=3&height=${spec.barcodeH}`;
    return `
      <div class="lbl">
        <div class="l-header">${escHtml(header)}</div>
        ${detail ? `<div class="l-detail">${escHtml(detail)}</div>` : ''}
        ${showMrp ? `<div class="l-mrp-line">${escHtml(mrpFmt + spFmt)}</div>` : ''}
        <div class="l-barcode"><img src="${barcodeUrl}" alt="barcode" /></div>
        <div class="l-serial">${escHtml(p.serial_no || p.sku)}</div>
        ${showMrp && showGst && p.gst_rate ? `<div class="l-inc">Incl. ${p.gst_rate}% GST${p.hsn_code ? ' · HSN ' + escHtml(p.hsn_code) : ''}</div>` : ''}
      </div>
    `;
  }).join('');

  const printArea = document.getElementById('printArea');
  if (printArea) {
    const wrap = document.createElement('div');
    wrap.className = 'label-preview-area';
    wrap.innerHTML = printLabelsHtml;
    printArea.innerHTML = '';
    printArea.appendChild(wrap);
  }

  if (pc) pc.textContent = `— ${labels.length} label${labels.length !== 1 ? 's' : ''}`;
  state.previewDirty = false;
  showToast(`${labels.length} label${labels.length !== 1 ? 's' : ''} ready`, 'success');
}

async function printNow() {
  await generatePreview();

  // Inject exact @page size for TVS LP 40 Lite thermal printer
  const paperSize = (document.getElementById('labelPaperSize')?.value) || '38mm 25mm';
  let ps = document.getElementById('_lpStyle');
  if (!ps) { ps = document.createElement('style'); ps.id = '_lpStyle'; document.head.appendChild(ps); }
  // Top-level @page overrides the @media print @page in stylesheet
  ps.textContent = paperSize !== 'auto'
    ? `@page { size: ${paperSize}; margin: 0; }`
    : '';

  const deduct = document.getElementById('deductStock').value === '1';
  // Save print job (and optionally deduct stock)
  try {
    await apiFetch('/api/print-jobs', 'POST', {
      items: state.queue.map(q => ({ productId: q.product.id, qty: q.qty })),
      deductStock: deduct,
    });
    if (deduct) {
      showToast('Stock updated for printed products', 'success');
      if (state.activePage === 'products') loadProducts();
    }
  } catch (e) { /* non-fatal */ }

  setTimeout(() => window.print(), 700);
}

function showDeductBanner() {
  const banner = document.getElementById('deductBanner');
  if (banner) banner.style.display = document.getElementById('deductStock').value === '1' ? '' : 'none';
}

// ─── Global Search ─────────────────────────────────────────────────────────────
let searchTimeout;
function globalSearchFn(val) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (!val.trim()) return;
    document.getElementById('prodSearch').value = val;
    state.currentPage = 1;
    goPage('products');
    loadProducts();
  }, 350);
}

function loadSampleSearch() {
  state.currentPage = 1;
  document.getElementById('catFilter').value = 'cat_mob';
  goPage('products');
  loadProducts();
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
async function apiFetch(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = 'toast'; }, 3400);
}
