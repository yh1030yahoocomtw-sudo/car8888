const KEY = 'modelCarMarketV3';
const OLD_KEYS = ['modelCarMarketV2', 'modelCarMarket'];
const $ = id => document.getElementById(id);
let records = loadRecords();
let pendingPhoto = '';

function loadRecords(){
  const current = localStorage.getItem(KEY);
  if(current) return JSON.parse(current);
  for(const k of OLD_KEYS){
    const old = localStorage.getItem(k);
    if(old){
      const data = JSON.parse(old).map(r => ({condition: r.condition || r.status || '拆檢', ...r}));
      localStorage.setItem(KEY, JSON.stringify(data));
      return data;
    }
  }
  return [];
}
function money(n){ return Number(n) ? `NT$ ${Math.round(Number(n)).toLocaleString()}` : '—'; }
function norm(s){ return (s || '').trim().toLowerCase().replace(/\s+/g,' '); }
function carKey(r){ return `${norm(r.brand)}|${norm(r.model)}|${norm(r.scale)}`; }
function save(){ localStorage.setItem(KEY, JSON.stringify(records)); }
function toast(msg){ const t=$('toast'); if(!t) return; t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),1800); }

async function compressImage(file){
  const dataUrl = await new Promise(res => { const reader = new FileReader(); reader.onload = () => res(reader.result); reader.readAsDataURL(file); });
  const img = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = dataUrl; });
  const max = 1200; let w = img.width, h = img.height;
  if(w > h && w > max){ h = Math.round(h * max / w); w = max; }
  if(h >= w && h > max){ w = Math.round(w * max / h); h = max; }
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img,0,0,w,h);
  return canvas.toDataURL('image/jpeg',0.72);
}

$('photo').addEventListener('change', async e => {
  const file = e.target.files[0];
  if(!file) return;
  pendingPhoto = await compressImage(file);
  $('preview').src = pendingPhoto;
  $('preview').classList.remove('hidden');
});

$('recordForm').addEventListener('submit', e => {
  e.preventDefault();
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    date: new Date().toISOString(),
    brand: $('brand').value.trim(),
    scale: $('scale').value.trim(),
    model: $('model').value.trim(),
    price: Number($('price').value),
    source: $('source').value.trim() || '未填',
    condition: $('condition') ? $('condition').value : '拆檢',
    note: $('note').value.trim(),
    photo: pendingPhoto
  };
  records.unshift(record); save(); e.target.reset(); pendingPhoto=''; $('preview').classList.add('hidden'); render(); toast('已加入行情紀錄');
});

$('search').addEventListener('input', render);
$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(records,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `model-car-market-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
});
if($('importFile')) $('importFile').addEventListener('change', e => {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if(!Array.isArray(data)) throw new Error('不是陣列');
      const ids = new Set(records.map(r=>r.id)); let added = 0;
      for(const r of data){ if(!ids.has(r.id)){ records.push({condition:r.condition || r.status || '拆檢', ...r}); added++; } }
      records.sort((a,b)=>new Date(b.date)-new Date(a.date)); save(); render(); toast(`已匯入 ${added} 筆`);
    }catch(err){ alert('匯入失敗，請選擇正確的 JSON 備份檔'); }
  };
  reader.readAsText(file);
});
$('closeDialog').addEventListener('click', () => $('detailDialog').close());

function groupCars(){
  const map = new Map();
  for(const r of records){
    const key = carKey(r);
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return [...map.values()].map(list => {
    const prices = list.map(x=>Number(x.price)).filter(Boolean).sort((a,b)=>a-b);
    const avg = prices.reduce((a,b)=>a+b,0) / (prices.length || 1);
    const min = prices[0] || 0;
    const max = prices[prices.length-1] || 0;
    const recent = [...list].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
    const buy = avg ? Math.min(avg * 0.85, min ? min * 0.96 : avg * 0.85) : 0;
    const sweet = avg ? avg * 0.78 : 0;
    const expensive = avg ? avg * 1.18 : 0;
    const sellLow = avg ? avg * 1.08 : 0;
    const sellHigh = avg ? avg * 1.22 : 0;
    const oldest = [...list].sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
    const change = oldest?.price && recent?.price ? ((recent.price-oldest.price)/oldest.price)*100 : 0;
    return { key: carKey(recent), list, recent, avg, min, max, buy, sweet, expensive, sellLow, sellHigh, count:list.length, change };
  }).sort((a,b)=>new Date(b.recent.date)-new Date(a.recent.date));
}

function render(){
  const q = norm($('search').value);
  let cars = groupCars();
  if(q) cars = cars.filter(c => norm(`${c.recent.brand} ${c.recent.model} ${c.recent.scale} ${c.recent.note} ${c.recent.condition}`).includes(q));
  window.currentCars = cars;
  renderStats(cars); renderCards(cars);
}

function renderStats(cars){
  const allPrices = cars.flatMap(c=>c.list.map(r=>Number(r.price))).filter(Boolean);
  const avg = allPrices.reduce((a,b)=>a+b,0)/(allPrices.length||1);
  $('summaryStats').innerHTML = `
    <div class="stat"><span>車款數</span><strong>${cars.length}</strong></div>
    <div class="stat"><span>價格紀錄</span><strong>${allPrices.length}</strong></div>
    <div class="stat"><span>全站平均</span><strong>${money(avg)}</strong></div>
    <div class="stat"><span>最高紀錄</span><strong>${money(Math.max(0,...allPrices))}</strong></div>`;
}

function renderCards(cars){
  if(!cars.length){ $('cards').innerHTML = '<div class="empty">還沒有資料，先新增一筆模型車行情紀錄。</div>'; return; }
  $('cards').innerHTML = cars.map((c,i)=>`
    <article class="card" onclick="openDetail(${i})">
      ${c.recent.photo ? `<img src="${c.recent.photo}" alt="${esc(c.recent.model)}">` : '<div class="empty" style="border:0;border-radius:0;height:180px">無照片</div>'}
      <div class="card-body">
        <span class="tag">${esc(c.recent.brand) || '未填品牌'}</span><span class="tag">${esc(c.recent.scale) || '比例未填'}</span>
        <h3>${esc(c.recent.model)}</h3>
        <div class="price-grid">
          <div class="price-box"><span>平均行情</span><strong>${money(c.avg)}</strong></div>
          <div class="price-box"><span>建議購買</span><strong class="buy">${money(c.buy)} 以下</strong></div>
          <div class="price-box"><span>偏貴區</span><strong class="bad">${money(c.expensive)} 以上</strong></div>
          <div class="price-box"><span>建議賣價</span><strong class="sell">${money(c.sellLow)}~${money(c.sellHigh)}</strong></div>
        </div>
      </div>
    </article>`).join('');
}

window.openDetail = function(index){
  const c = window.currentCars[index];
  const trendText = c.change > 5 ? `價格比最早紀錄上升約 ${c.change.toFixed(1)}%` : c.change < -5 ? `價格比最早紀錄下降約 ${Math.abs(c.change).toFixed(1)}%` : '價格目前大致穩定';
  const rows = [...c.list].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(r=>`
    <tr><td>${new Date(r.date).toLocaleDateString()}</td><td>${money(r.price)}</td><td>${esc(r.source)}</td><td>${esc(r.condition || '')}</td><td>${esc(r.note || '')}</td><td><button class="danger" onclick="event.stopPropagation();deleteRecord('${r.id}')">刪除</button></td></tr>`).join('');
  $('detailContent').innerHTML = `
    ${c.recent.photo ? `<img class="detail-img" src="${c.recent.photo}" alt="${esc(c.recent.model)}">` : ''}
    <h2>${esc(c.recent.brand)} ${esc(c.recent.model)}</h2>
    <p><span class="tag">${esc(c.recent.scale) || '比例未填'}</span><span class="tag">資料 ${c.count} 筆</span><span class="tag">${trendText}</span></p>
    <div class="price-grid">
      <div class="price-box"><span>平均行情</span><strong>${money(c.avg)}</strong></div>
      <div class="price-box"><span>建議購買價格</span><strong class="buy">${money(c.buy)} 以下</strong></div>
      <div class="price-box"><span>超甜價</span><strong class="warn">${money(c.sweet)} 以下</strong></div>
      <div class="price-box"><span>偏貴價格</span><strong class="bad">${money(c.expensive)} 以上</strong></div>
      <div class="price-box"><span>最低 / 最高</span><strong>${money(c.min)} / ${money(c.max)}</strong></div>
      <div class="price-box"><span>建議賣價</span><strong class="sell">${money(c.sellLow)}~${money(c.sellHigh)}</strong></div>
    </div>
    <div class="advice"><b>購買判斷：</b><br>低於平均行情約 15% 可考慮收；低於 22% 算甜價。高於平均行情約 18% 以上偏貴，除非是稀有色、限定版、全新或盒況特別好。<br><b>目前趨勢：</b>${trendText}。</div>
    <canvas id="chart" class="mini-chart"></canvas>
    <div class="detail-actions"><button class="ghost" onclick="fillSameCar(${index})">用這台資料新增價格</button></div>
    <table class="history"><thead><tr><th>日期</th><th>價格</th><th>來源</th><th>車況</th><th>備註</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  $('detailDialog').showModal(); setTimeout(()=>drawChart(c.list),50);
}

window.fillSameCar = function(index){
  const r = window.currentCars[index].recent;
  $('brand').value = r.brand; $('model').value = r.model; $('scale').value = r.scale; $('price').focus();
  $('detailDialog').close(); toast('已帶入同車款，直接填新價格');
}
window.deleteRecord = function(id){
  if(!confirm('確定刪除這筆價格紀錄？')) return;
  records = records.filter(r=>r.id !== id); save(); $('detailDialog').close(); render(); toast('已刪除');
}

function drawChart(list){
  const canvas = $('chart'); if(!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr);
  const w = canvas.clientWidth, h = canvas.clientHeight, pad = 26;
  const data = [...list].sort((a,b)=>new Date(a.date)-new Date(b.date)).map(r=>Number(r.price)).filter(Boolean);
  ctx.clearRect(0,0,w,h); ctx.strokeStyle='#30363d'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(pad,h-pad); ctx.lineTo(w-pad,h-pad); ctx.lineTo(w-pad,pad); ctx.stroke();
  if(data.length < 2){ ctx.fillStyle='#8b949e'; ctx.fillText('資料至少 2 筆才會形成趨勢圖', pad, h/2); return; }
  const min=Math.min(...data), max=Math.max(...data), range=max-min || 1;
  ctx.strokeStyle='#58a6ff'; ctx.lineWidth=3; ctx.beginPath();
  data.forEach((v,i)=>{ const x=pad+(w-pad*2)*(i/(data.length-1)); const y=(h-pad)-((v-min)/range)*(h-pad*2); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }); ctx.stroke();
  ctx.fillStyle='#e6edf3'; ctx.fillText(`低 ${money(min)}  高 ${money(max)}`, pad, 18);
}
function esc(str){ return String(str || '').replace(/[&<>\"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }
render();
