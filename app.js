const STORAGE_KEY = 'modelCarMarket.v1';
let photoData = '';

const $ = (id) => document.getElementById(id);
const today = new Date().toISOString().slice(0, 10);
$('date').value = today;

function loadRecords() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveRecords(records) { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function money(n) { return 'NT$' + Math.round(n).toLocaleString('zh-TW'); }
function keyOf(r) { return [r.brand, r.model, r.scale].join(' ').toLowerCase().replace(/\s+/g, ' ').trim(); }
function escapeHtml(str = '') {
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function groupRecords(records) {
  const map = new Map();
  records.forEach(r => {
    const key = keyOf(r);
    if (!map.has(key)) map.set(key, { key, brand: r.brand, model: r.model, scale: r.scale, photo: r.photo, records: [] });
    const item = map.get(key);
    item.records.push(r);
    if (!item.photo && r.photo) item.photo = r.photo;
  });
  return [...map.values()].map(item => {
    const prices = item.records.map(r => Number(r.price)).filter(n => !isNaN(n));
    const avg = prices.reduce((a,b) => a+b, 0) / prices.length;
    const sortedByDate = [...item.records].sort((a,b) => (b.date || '').localeCompare(a.date || ''));
    return { ...item, count: prices.length, avg, min: Math.min(...prices), max: Math.max(...prices), latest: sortedByDate[0] };
  }).sort((a,b) => (b.latest?.date || '').localeCompare(a.latest?.date || ''));
}
function getFilteredGroups() {
  const q = $('search').value.trim().toLowerCase();
  const groups = groupRecords(loadRecords());
  if (!q) return groups;
  return groups.filter(g => [g.brand, g.model, g.scale].join(' ').toLowerCase().includes(q));
}
function renderStats(groups) {
  const stats = $('stats');
  const records = groups.flatMap(g => g.records);
  if (!records.length) {
    stats.className = 'stats empty-state';
    stats.textContent = '沒有符合資料。可以換關鍵字，或先新增價格紀錄。';
    return;
  }
  const prices = records.map(r => Number(r.price));
  const avg = prices.reduce((a,b) => a+b,0) / prices.length;
  stats.className = 'stats';
  stats.innerHTML = `
    <div class="stat-card"><div class="stat-label">平均行情</div><div class="stat-value">${money(avg)}</div></div>
    <div class="stat-card"><div class="stat-label">最低價</div><div class="stat-value">${money(Math.min(...prices))}</div></div>
    <div class="stat-card"><div class="stat-label">最高價</div><div class="stat-value">${money(Math.max(...prices))}</div></div>
    <div class="stat-card"><div class="stat-label">資料筆數</div><div class="stat-value">${records.length}</div></div>
  `;
}
function renderList() {
  const groups = getFilteredGroups();
  renderStats(groups);
  const list = $('carList');
  if (!groups.length) {
    list.innerHTML = '<div class="empty-state">尚無模型車資料。</div>';
    return;
  }
  list.innerHTML = groups.map(g => `
    <article class="car-card">
      ${g.photo ? `<img class="car-thumb" src="${g.photo}" alt="${escapeHtml(g.model)}">` : `<div class="car-thumb">無照片</div>`}
      <div>
        <div class="car-title">${escapeHtml(g.brand)} ${escapeHtml(g.model)}</div>
        <div class="car-meta">比例：${escapeHtml(g.scale || '未填')}｜紀錄 ${g.count} 筆｜最低 ${money(g.min)}｜最高 ${money(g.max)}<br>最近：${escapeHtml(g.latest?.date || '')} ${money(g.latest?.price || 0)} ${escapeHtml(g.latest?.source || '')}</div>
      </div>
      <button class="ghost-btn" onclick="openDetail('${encodeURIComponent(g.key)}')">看行情</button>
      <div class="price-badge">${money(g.avg)}</div>
    </article>
  `).join('');
}
window.openDetail = function(encodedKey) {
  const key = decodeURIComponent(encodedKey);
  const group = groupRecords(loadRecords()).find(g => g.key === key);
  if (!group) return;
  $('detailTitle').textContent = `${group.brand} ${group.model}`;
  const buyTarget = group.avg * 0.8;
  const sellTarget = group.avg * 1.12;
  const rows = [...group.records].sort((a,b) => (b.date || '').localeCompare(a.date || '')).map(r => `
    <tr><td>${escapeHtml(r.date)}</td><td>${money(r.price)}</td><td>${escapeHtml(r.source)}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.note)}</td></tr>
  `).join('');
  $('detailBody').innerHTML = `
    <div class="stats">
      <div class="stat-card"><div class="stat-label">平均行情</div><div class="stat-value">${money(group.avg)}</div></div>
      <div class="stat-card"><div class="stat-label">建議買入</div><div class="stat-value">${money(buyTarget)}↓</div></div>
      <div class="stat-card"><div class="stat-label">建議轉賣</div><div class="stat-value">${money(sellTarget)}↑</div></div>
      <div class="stat-card"><div class="stat-label">範圍</div><div class="stat-value">${money(group.min)}-${money(group.max)}</div></div>
    </div>
    <h3>價格紀錄</h3>
    <table class="record-table"><thead><tr><th>日期</th><th>價格</th><th>來源</th><th>狀態</th><th>備註</th></tr></thead><tbody>${rows}</tbody></table>
  `;
  $('detailDialog').showModal();
}
$('photo').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    photoData = reader.result;
    $('preview').innerHTML = `<img src="${photoData}" alt="preview">`;
  };
  reader.readAsDataURL(file);
});
$('carForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const record = {
    id: crypto.randomUUID(),
    photo: photoData,
    brand: $('brand').value.trim(),
    scale: $('scale').value.trim(),
    model: $('model').value.trim(),
    price: Number($('price').value),
    source: $('source').value.trim(),
    status: $('status').value,
    date: $('date').value || today,
    note: $('note').value.trim(),
    createdAt: new Date().toISOString()
  };
  const records = loadRecords();
  records.push(record);
  saveRecords(records);
  e.target.reset();
  $('date').value = today;
  photoData = '';
  $('preview').textContent = '照片預覽';
  renderList();
});
$('search').addEventListener('input', renderList);
$('closeDialog').addEventListener('click', () => $('detailDialog').close());
$('clearBtn').addEventListener('click', () => {
  if (confirm('確定要清空所有模型車資料嗎？')) {
    localStorage.removeItem(STORAGE_KEY);
    renderList();
  }
});
$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(loadRecords(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `model-car-market-${today}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
renderList();
