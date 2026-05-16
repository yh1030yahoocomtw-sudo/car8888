const KEY = 'modelCarMarketV2';
const $ = id => document.getElementById(id);
let records = JSON.parse(localStorage.getItem(KEY) || '[]');
let pendingPhoto = '';

function money(n){ return n ? `NT$ ${Math.round(n).toLocaleString()}` : '—'; }
function norm(s){ return (s || '').trim().toLowerCase(); }
function carKey(r){ return `${norm(r.brand)}|${norm(r.model)}|${norm(r.scale)}`; }
function save(){ localStorage.setItem(KEY, JSON.stringify(records)); }

$('photo').addEventListener('change', e => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => { pendingPhoto = reader.result; $('preview').src = pendingPhoto; $('preview').classList.remove('hidden'); };
  reader.readAsDataURL(file);
});

$('recordForm').addEventListener('submit', e => {
  e.preventDefault();
  const record = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    brand: $('brand').value.trim(),
    scale: $('scale').value.trim(),
    model: $('model').value.trim(),
    price: Number($('price').value),
    source: $('source').value.trim() || '未填',
    status: $('status').value,
    note: $('note').value.trim(),
    photo: pendingPhoto
  };
  records.unshift(record); save(); e.target.reset(); pendingPhoto=''; $('preview').classList.add('hidden'); render();
});

$('search').addEventListener('input', render);
$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(records,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'model-car-market-backup.json'; a.click();
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
    const prices = list.map(x=>x.price).filter(Boolean).sort((a,b)=>a-b);
    const avg = prices.reduce((a,b)=>a+b,0) / (prices.length || 1);
    const min = prices[0] || 0;
    const max = prices[prices.length-1] || 0;
    const recent = [...list].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
    const buy = avg ? Math.min(avg * 0.85, min * 0.95 || avg * 0.85) : 0;
    const goodBuy = avg ? avg * 0.8 : 0;
    const sellLow = avg ? avg * 1.08 : 0;
    const sellHigh = avg ? avg * 1.18 : 0;
    return { key: carKey(recent), list, recent, avg, min, max, buy, goodBuy, sellLow, sellHigh, count:list.length };
  }).sort((a,b)=>new Date(b.recent.date)-new Date(a.recent.date));
}

function render(){
  const q = norm($('search').value);
  let cars = groupCars();
  if(q) cars = cars.filter(c => norm(`${c.recent.brand} ${c.recent.model} ${c.recent.scale} ${c.recent.note}`).includes(q));
  renderStats(cars); renderCards(cars);
}

function renderStats(cars){
  const allPrices = cars.flatMap(c=>c.list.map(r=>r.price)).filter(Boolean);
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
      ${c.recent.photo ? `<img src="${c.recent.photo}" alt="${c.recent.model}">` : '<div class="empty" style="border:0;border-radius:0;height:180px">無照片</div>'}
      <div class="card-body">
        <span class="tag">${c.recent.brand || '未填品牌'}</span><span class="tag">${c.recent.scale || '比例未填'}</span>
        <h3>${c.recent.model}</h3>
        <div class="price-grid">
          <div class="price-box"><span>平均行情</span><strong>${money(c.avg)}</strong></div>
          <div class="price-box"><span>建議購買</span><strong class="buy">${money(c.buy)} 以下</strong></div>
          <div class="price-box"><span>最低 / 最高</span><strong>${money(c.min)} / ${money(c.max)}</strong></div>
          <div class="price-box"><span>轉賣建議</span><strong class="sell">${money(c.sellLow)}~${money(c.sellHigh)}</strong></div>
        </div>
      </div>
    </article>`).join('');
  window.currentCars = cars;
}

window.openDetail = function(index){
  const c = window.currentCars[index];
  const rows = [...c.list].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(r=>`
    <tr><td>${new Date(r.date).toLocaleDateString()}</td><td>${money(r.price)}</td><td>${r.source}</td><td>${r.status}</td><td>${r.note || ''}</td></tr>`).join('');
  $('detailContent').innerHTML = `
    ${c.recent.photo ? `<img class="detail-img" src="${c.recent.photo}" alt="${c.recent.model}">` : ''}
    <h2>${c.recent.brand} ${c.recent.model}</h2>
    <p><span class="tag">${c.recent.scale || '比例未填'}</span><span class="tag">資料 ${c.count} 筆</span></p>
    <div class="price-grid">
      <div class="price-box"><span>平均行情</span><strong>${money(c.avg)}</strong></div>
      <div class="price-box"><span>建議購買價格</span><strong class="buy">${money(c.buy)} 以下</strong></div>
      <div class="price-box"><span>超甜價</span><strong class="warn">${money(c.goodBuy)} 以下</strong></div>
      <div class="price-box"><span>建議賣價</span><strong class="sell">${money(c.sellLow)}~${money(c.sellHigh)}</strong></div>
    </div>
    <div class="advice">判斷：低於平均行情約 15% 可考慮收；低於 20% 算很漂亮。高於平均行情 15% 以上就偏貴，除非是稀有色、限定版或盒況特別好。</div>
    <canvas id="chart" class="mini-chart"></canvas>
    <table class="history"><thead><tr><th>日期</th><th>價格</th><th>來源</th><th>狀態</th><th>備註</th></tr></thead><tbody>${rows}</tbody></table>`;
  $('detailDialog').showModal();
  setTimeout(()=>drawChart(c.list),50);
}

function drawChart(list){
  const canvas = $('chart'); if(!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr);
  const w = canvas.clientWidth, h = canvas.clientHeight, pad = 26;
  const data = [...list].sort((a,b)=>new Date(a.date)-new Date(b.date)).map(r=>r.price).filter(Boolean);
  ctx.clearRect(0,0,w,h); ctx.strokeStyle='#30363d'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(pad,h-pad); ctx.lineTo(w-pad,h-pad); ctx.lineTo(w-pad,pad); ctx.stroke();
  if(data.length < 2){ ctx.fillStyle='#8b949e'; ctx.fillText('資料至少 2 筆才會形成趨勢圖', pad, h/2); return; }
  const min=Math.min(...data), max=Math.max(...data), range=max-min || 1;
  ctx.strokeStyle='#58a6ff'; ctx.lineWidth=3; ctx.beginPath();
  data.forEach((v,i)=>{ const x=pad+(w-pad*2)*(i/(data.length-1)); const y=(h-pad)-((v-min)/range)*(h-pad*2); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }); ctx.stroke();
  ctx.fillStyle='#e6edf3'; ctx.fillText(`低 ${money(min)}  高 ${money(max)}`, pad, 18);
}

render();
