/* ============================================================
   TÆPPIN' — client-side simulation (Vite)
   ============================================================ */
import './style.css';
import { Delaunay } from 'd3-delaunay';

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const FACTIONS = {
  ruby:   { name: 'Ruby',   color: '#EF4444', desc: 'Relentless. First to strike, last to fold.' },
  cobalt: { name: 'Cobalt', color: '#3B82F6', desc: 'Calculated. Control the centre, win the city.' },
  jade:   { name: 'Jade',   color: '#22C55E', desc: 'Grassroots. Strength in the neighbourhoods.' },
  amber:  { name: 'Amber',  color: '#F59E0B', desc: 'Fast & loud. Swarm, flip, repeat.' },
};
const FKEYS = Object.keys(FACTIONS);
const SHIELD_MS = 30000;          // demo shield = 30s
const TICK_MS   = 1500;

// 20 Oslo merchants
const RAW = [
  ['Kiwi Grünerløkka', 59.9231, 10.7551],
  ['Narvesen Youngstorget', 59.9133, 10.7468],
  ['7-Eleven Aker Brygge', 59.9094, 10.7290],
  ['Rema 1000 Majorstuen', 59.9265, 10.7175],
  ['Kiwi Frogner', 59.9185, 10.7102],
  ['Espresso House Sentrum', 59.9120, 10.7390],
  ['Tim Wendelboe Grünerløkka', 59.9258, 10.7560],
  ['Narvesen Oslo S', 59.9105, 10.7530],
  ['Rema 1000 Grønland', 59.9099, 10.7609],
  ['Kiwi Bislett', 59.9223, 10.7258],
  ['Meny Frogner', 59.9152, 10.7065],
  ['7-Eleven T-bane Stortinget', 59.9130, 10.7413],
  ['Bunnpris St. Hanshaugen', 59.9262, 10.7365],
  ['Narvesen Nationaltheatret', 59.9145, 10.7340],
  ['Kiwi Tøyen', 59.9138, 10.7715],
  ['Rema 1000 Sagene', 59.9300, 10.7470],
  ['Starbucks Karl Johans Gate', 59.9123, 10.7458],
  ['Deli de Luca Aker Brygge', 59.9087, 10.7276],
  ['Kiwi Grønland', 59.9088, 10.7652],
  ['Narvesen Majorstuen', 59.9277, 10.7188],
  ['Kiwi Torshov', 59.9342, 10.7625],
  ['Rema 1000 Sofienberg', 59.9205, 10.7670],
  ['Narvesen Tøyen T-bane', 59.9148, 10.7780],
  ['Bunnpris Kampen', 59.9130, 10.7805],
  ['Joker Gamlebyen', 59.9060, 10.7680],
  ['Kiwi Bjørvika', 59.9075, 10.7560],
  ['Espresso House Barcode', 59.9070, 10.7610],
  ['Meny Tjuvholmen', 59.9060, 10.7220],
  ['7-Eleven Vika', 59.9118, 10.7280],
  ['Narvesen Solli plass', 59.9150, 10.7230],
  ['Kiwi Skillebekk', 59.9135, 10.7150],
  ['Rema 1000 Adamstuen', 59.9320, 10.7320],
  ['Bunnpris Marienlyst', 59.9355, 10.7270],
  ['Joker Fagerborg', 59.9290, 10.7280],
  ['Kiwi Vulkan', 59.9225, 10.7510],
  ['Narvesen Olaf Ryes plass', 59.9243, 10.7585],
  ['Espresso House Grünerløkka', 59.9248, 10.7595],
  ['7-Eleven Carl Berner', 59.9300, 10.7790],
  ['Rema 1000 Sinsen', 59.9360, 10.7800],
  ['Kiwi Ila', 59.9290, 10.7480],
];
const STORE_COUNT = RAW.length;

// build merchants: owners spread ~evenly across factions, ~20% start shielded
function buildMerchants() {
  const owners = [];
  for (let i = 0; i < STORE_COUNT; i++) owners.push(FKEYS[i % FKEYS.length]);
  // shuffle owners
  for (let i = owners.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [owners[i],owners[j]]=[owners[j],owners[i]]; }
  const shieldCount = Math.round(STORE_COUNT * 0.2);
  const shieldedIdx = new Set();
  while (shieldedIdx.size < shieldCount) shieldedIdx.add(Math.floor(Math.random()*STORE_COUNT));

  return RAW.map((m, i) => {
    const owner = owners[i];
    const scores = { ruby:0, cobalt:0, jade:0, amber:0 };
    // seed scores so the current owner leads
    FKEYS.forEach(f => scores[f] = 3 + Math.floor(Math.random()*6));
    scores[owner] += 12 + Math.floor(Math.random()*8);
    const shielded = shieldedIdx.has(i);
    return {
      id: i, name: m[0], lat: m[1], lng: m[2],
      owner, scores, shielded,
      shieldExpires: shielded ? Date.now() + SHIELD_MS : null,
    };
  });
}

let merchants = buildMerchants();
let userFaction = null;
let carePackages = 0;
let userTriggeredVault = false;
const totalTaps = { ruby:0, cobalt:0, jade:0, amber:0 };
const memberCounts = { ruby: 0, cobalt: 0, jade: 0, amber: 0 };
FKEYS.forEach(f => memberCounts[f] = 800 + Math.floor(Math.random()*900));

const leader = m => FKEYS.reduce((a,b) => m.scores[b] > m.scores[a] ? b : a, FKEYS[0]);
const storeCounts = () => { const c={ruby:0,cobalt:0,jade:0,amber:0}; merchants.forEach(m=>c[m.owner]++); return c; };

/* ---------------- FACTION PICKER ---------------- */
const fgrid = document.getElementById('faction-grid');
FKEYS.forEach(f => {
  const F = FACTIONS[f];
  const card = document.createElement('div');
  card.className = 'faction-card';
  card.style.setProperty('--fc', F.color);
  card.style.setProperty('--fc-glow', F.color + '33');
  card.style.setProperty('--fc-soft', F.color + '55');
  card.innerHTML = `
    <span class="you-in">YOU ARE IN</span>
    <div class="initial">${F.name[0]}</div>
    <h3>${F.name}</h3>
    <div class="desc">${F.desc}</div>
    <div class="members"><b id="mem-${f}">${memberCounts[f].toLocaleString()}</b> warriors</div>
  `;
  card.addEventListener('click', () => joinFaction(f));
  fgrid.appendChild(card);
});

function joinFaction(f) {
  userFaction = f;
  document.querySelectorAll('.faction-card').forEach((c, i) => c.classList.toggle('selected', FKEYS[i] === f));
  renderTapZone();
  renderScoreboard();
  updateCare();
  showToast(`You joined ${FACTIONS[f].name}! Tap to fight for Oslo.`);
}

function renderTapZone() {
  const tz = document.getElementById('tap-zone');
  if (!userFaction) { tz.innerHTML = ''; return; }
  tz.innerHTML = `<button class="tap-btn" id="tap-btn">⚡ TAP NOW <span style="font-size:14px;font-weight:500;">(Simulate Payment)</span></button>`;
  document.getElementById('tap-btn').addEventListener('click', onTap);
}

/* ---------------- MAP (Google Maps JS API) ---------------- */
// Dark theme tuned to the neutral + orange palette.
const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d20' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0e0e10' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2a2a2e' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#18241b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1d1d20' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a40' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b0b0d' }] },
];

// --- Turf-wars territory: a Voronoi cell per store, coloured by its owner ---
const lats = merchants.map(m => m.lat);
const lngs = merchants.map(m => m.lng);
const PAD_LAT = 0.006, PAD_LNG = 0.012;
const bbox = [
  Math.min(...lngs) - PAD_LNG, Math.min(...lats) - PAD_LAT,
  Math.max(...lngs) + PAD_LNG, Math.max(...lats) + PAD_LAT,
];
// d3-delaunay works in x/y; use lng as x and lat as y.
const delaunay = Delaunay.from(merchants.map(m => [m.lng, m.lat]));
const voronoi = delaunay.voronoi(bbox);

let map = null;
let infoWindow = null;
let openInfoId = null;
const cells = {};
const markers = {};

function territoryStyle(owner) {
  const c = FACTIONS[owner].color;
  return { strokeColor: c, strokeOpacity: 0.9, strokeWeight: 1.5, fillColor: c, fillOpacity: 0.30 };
}
function storeIcon(owner) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 6, fillColor: FACTIONS[owner].color, fillOpacity: 1,
    strokeColor: '#ffffff', strokeWeight: 2,
  };
}

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve();
    if (!GMAPS_KEY) return reject(new Error('missing-key'));
    window.__initGMaps = () => resolve();
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GMAPS_KEY)}&v=weekly&callback=__initGMaps`;
    s.async = true;
    s.onerror = () => reject(new Error('load-failed'));
    document.head.appendChild(s);
  });
}

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 59.9139, lng: 10.7522 },
    zoom: 14,
    backgroundColor: '#0E0E10',
    styles: DARK_STYLE,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false,
  });
  infoWindow = new google.maps.InfoWindow();
  infoWindow.addListener('closeclick', () => { openInfoId = null; });

  merchants.forEach((m, i) => {
    // territory polygon
    const poly = voronoi.cellPolygon(i);
    if (poly) {
      const path = poly.map(([x, y]) => ({ lat: y, lng: x }));
      const cell = new google.maps.Polygon({ paths: path, map, ...territoryStyle(m.owner) });
      cell.addListener('click', () => openInfo(m));
      cells[m.id] = cell;
    }
    // store pin on top of its territory
    const mk = new google.maps.Marker({
      position: { lat: m.lat, lng: m.lng },
      map, icon: storeIcon(m.owner), zIndex: 10,
      title: m.name + (m.shielded ? ' 🔒' : ''),
    });
    mk.addListener('click', () => openInfo(m));
    markers[m.id] = mk;
  });
}

function openInfo(m) {
  if (!infoWindow) return;
  infoWindow.setContent(popupHTML(m));
  infoWindow.open({ anchor: markers[m.id], map });
  openInfoId = m.id;
}

function showMapError(err) {
  const el = document.getElementById('map');
  if (el) {
    const msg = err && err.message === 'missing-key'
      ? 'Google Maps API key missing — add <code>VITE_GOOGLE_MAPS_API_KEY</code> to a <code>.env</code> file (see README).'
      : 'Google Maps failed to load. Check the API key, billing, and allowed HTTP referrers.';
    el.innerHTML = `<div class="map-error">${msg}</div>`;
  }
}

function updateMarkerTooltip(m) {
  const mk = markers[m.id];
  if (mk) mk.setTitle(m.name + (m.shielded ? ' 🔒' : ''));
}

function popupHTML(m) {
  const total = FKEYS.reduce((s,f)=>s+m.scores[f],0) || 1;
  let rows = FKEYS.map(f => {
    const pct = Math.round(m.scores[f]/total*100);
    return `<div class="pop-row"><span class="nm">${FACTIONS[f].name}</span>
      <span class="pop-bar"><span style="width:${pct}%;background:${FACTIONS[f].color}"></span></span>
      <span class="vv">${m.scores[f]}</span></div>`;
  }).join('');
  const shieldTxt = m.shielded
    ? `🔒 Shielded — protected for now`
    : `🔓 Open — can be captured`;
  return `<div class="pop-title">${m.name}</div>
    <div class="pop-owner" style="color:${FACTIONS[m.owner].color}">● Owned by ${FACTIONS[m.owner].name}</div>
    ${rows}
    <div class="pop-shield">${shieldTxt}</div>`;
}

function setMarkerOwner(m, animate) {
  const mk = markers[m.id];
  const cell = cells[m.id];
  if (mk) mk.setIcon(storeIcon(m.owner));
  if (cell) cell.setOptions(territoryStyle(m.owner));
  updateMarkerTooltip(m);
  if (openInfoId === m.id && infoWindow) infoWindow.setContent(popupHTML(m));
  if (animate && (mk || cell)) {
    // flash the captured turf white, then settle into the new faction colour
    if (mk) mk.setIcon({ ...storeIcon(m.owner), fillColor: '#ffffff' });
    if (cell) cell.setOptions({ strokeColor: '#ffffff', fillColor: '#ffffff', fillOpacity: 0.6 });
    setTimeout(() => {
      if (mk) mk.setIcon(storeIcon(m.owner));
      if (cell) cell.setOptions(territoryStyle(m.owner));
    }, 280);
  }
}

/* ---------------- SCOREBOARD ---------------- */
const sgrid = document.getElementById('score-grid');
const scoreEls = {};
FKEYS.forEach(f => {
  const F = FACTIONS[f];
  const card = document.createElement('div');
  card.className = 'score-card';
  card.id = 'score-' + f;
  card.style.setProperty('--fc', F.color);
  card.style.setProperty('--fc-glow', F.color + '44');
  card.innerHTML = `
    <span class="mine-tag" style="display:none">YOUR FACTION</span>
    <div class="fname"><span class="sw" style="background:${F.color}"></span>${F.name}</div>
    <div class="big" id="stores-${f}">0</div>
    <div class="big-l">Stores owned</div>
    <div class="taps"><b id="taps-${f}">0</b> taps today</div>
    <div class="ctrl-l"><span>City control</span><span id="pct-${f}">0%</span></div>
    <div class="ctrl-bar"><span id="bar-${f}" style="width:0%;background:${F.color}"></span></div>
  `;
  sgrid.appendChild(card);
  scoreEls[f] = {
    stores: card.querySelector('#stores-'+f),
    taps: card.querySelector('#taps-'+f),
    pct: card.querySelector('#pct-'+f),
    bar: card.querySelector('#bar-'+f),
    tag: card.querySelector('.mine-tag'),
    card,
  };
});

// animated counter
function animateNum(el, to) {
  const from = parseInt(el.dataset.val || '0', 10);
  if (from === to) return;
  el.dataset.val = to;
  const start = performance.now(), dur = 500;
  function step(now) {
    const t = Math.min(1, (now-start)/dur);
    const eased = 1 - Math.pow(1-t, 3);
    el.textContent = Math.round(from + (to-from)*eased).toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderScoreboard() {
  const counts = storeCounts();
  FKEYS.forEach(f => {
    const e = scoreEls[f];
    animateNum(e.stores, counts[f]);
    animateNum(e.taps, totalTaps[f]);
    const pct = Math.round(counts[f]/STORE_COUNT*100);
    e.pct.textContent = pct + '%';
    e.bar.style.width = pct + '%';
    const mine = f === userFaction;
    e.card.classList.toggle('mine', mine);
    e.tag.style.display = mine ? 'block' : 'none';
  });
}

/* ---------------- ACTIVITY FEED ---------------- */
const feedEl = document.getElementById('feed');
function timestamp() { const d=new Date(); return d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }

function pushFeed(html, faction, opts={}) {
  const item = document.createElement('div');
  item.className = 'feed-item flash' + (opts.mine ? ' mine-event' : '');
  item.innerHTML = `<span class="dot" style="background:${FACTIONS[faction].color}"></span>
    <span class="txt">${html}</span><span class="ts">${timestamp()}</span>`;
  feedEl.prepend(item);
  // keep newest 12; fade the rest out, then hard-remove any stragglers
  while (feedEl.children.length > 12) {
    const last = feedEl.lastElementChild;
    if (feedEl.children.length > 13) { last.remove(); continue; }
    last.style.transition = 'opacity .4s'; last.style.opacity = '0';
    setTimeout(() => last.remove(), 400);
    break;
  }
}

const USERNAMES = ['ola_99','kari_07','sondre_21','ingrid_x','magnus__','thea_88','jonas_no','emma_23','henrik_4','nora_w','aksel_12','live_oslo'];
const rnd = arr => arr[Math.floor(Math.random()*arr.length)];

/* ---------------- TAKEOVER LOGIC ---------------- */
function checkTakeover(m, animate=true) {
  const newLeader = leader(m);
  if (newLeader !== m.owner && !m.shielded) {
    m.owner = newLeader;
    m.shielded = true;
    m.shieldExpires = Date.now() + SHIELD_MS;
    setMarkerOwner(m, animate);
    carePackages += (newLeader === userFaction) ? 1 : 0;
    pushFeed(`<b>${FACTIONS[newLeader].name}</b> captured <b>${m.name}</b>`, newLeader);
    updateCare();
    return true;
  }
  return false;
}

/* ---------------- WEIGHTED FACTION PICK (underdog) ---------------- */
function pickFactionWeighted() {
  const counts = storeCounts();
  const lowThresh = STORE_COUNT * 0.15;   // < 15% territory
  const midThresh = STORE_COUNT * 0.25;   // < 25% territory
  const weights = FKEYS.map(f => {
    let w = 1;
    if (counts[f] < lowThresh) w = 3;      // strong underdog
    else if (counts[f] < midThresh) w = 1.8; // mild underdog
    return w;
  });
  const total = weights.reduce((a,b)=>a+b,0);
  let r = Math.random()*total;
  for (let i=0;i<FKEYS.length;i++){ r -= weights[i]; if (r<=0) return FKEYS[i]; }
  return FKEYS[0];
}

/* ---------------- TICK ---------------- */
function expireShields() {
  const now = Date.now();
  merchants.forEach(m => {
    if (m.shielded && m.shieldExpires && now > m.shieldExpires) {
      m.shielded = false; m.shieldExpires = null;
      updateMarkerTooltip(m);
      if (openInfoId === m.id && infoWindow) infoWindow.setContent(popupHTML(m));
    }
  });
}

function tick() {
  expireShields();
  const n = 1 + Math.floor(Math.random()*3); // 1-3 merchants
  for (let k=0;k<n;k++) {
    const m = merchants[Math.floor(Math.random()*merchants.length)];
    const f = pickFactionWeighted();
    const pts = 1 + Math.floor(Math.random()*3);
    m.scores[f] += pts;
    totalTaps[f] += pts;
    if (!checkTakeover(m)) {
      // occasionally surface a tap event
      if (Math.random() < 0.5) pushFeed(`User <b>@${rnd(USERNAMES)}</b> tapped at ${m.name}`, f);
    }
    if (openInfoId === m.id && infoWindow) infoWindow.setContent(popupHTML(m));
  }
  // member counts drift up
  FKEYS.forEach(f => {
    if (Math.random() < 0.6) {
      memberCounts[f] += Math.floor(Math.random()*4);
      const el = document.getElementById('mem-'+f);
      if (el) el.textContent = memberCounts[f].toLocaleString();
    }
  });
  renderScoreboard();
}

/* ---------------- USER TAP ---------------- */
function nearestToCenter() {
  const c = map ? map.getCenter() : null;
  const cLat = c ? c.lat() : 59.9139;
  const cLng = c ? c.lng() : 10.7522;
  let best = merchants[0], bd = Infinity;
  merchants.forEach(m => {
    const d = (m.lat-cLat)**2 + (m.lng-cLng)**2;
    if (d < bd) { bd = d; best = m; }
  });
  return best;
}

function onTap(e) {
  const btn = document.getElementById('tap-btn');
  // ripple
  const rect = btn.getBoundingClientRect();
  const rip = document.createElement('span');
  rip.className = 'ripple';
  const size = Math.max(rect.width, rect.height);
  rip.style.width = rip.style.height = size + 'px';
  rip.style.left = (e.clientX - rect.left - size/2) + 'px';
  rip.style.top = (e.clientY - rect.top - size/2) + 'px';
  btn.appendChild(rip);
  setTimeout(()=>rip.remove(), 600);

  const m = nearestToCenter();
  m.scores[userFaction] += 5;           // hero advantage
  totalTaps[userFaction] += 5;

  const took = checkTakeover(m);

  // user's event at top
  if (took && m.owner === userFaction) {
    pushFeed(`<b>YOU</b> just tapped at <b>${m.name}</b> and FLIPPED IT! 🔥`, userFaction, {mine:true});
    openVault(m.name);
  } else {
    pushFeed(`<b>YOU</b> just tapped at <b>${m.name}</b>! +1 capture point`, userFaction, {mine:true});
    showToast('Tap registered! +5 capture points');
  }
  if (openInfoId === m.id && infoWindow) infoWindow.setContent(popupHTML(m));
  renderScoreboard(); updateCare();

  // cooldown
  let left = 2;
  btn.disabled = true;
  const label = btn.innerHTML;
  btn.innerHTML = `⏳ Cooling down… <span class="cd">${left}s</span>`;
  const iv = setInterval(() => {
    left--;
    if (left <= 0) { clearInterval(iv); btn.disabled = false; btn.innerHTML = label; }
    else btn.innerHTML = `⏳ Cooling down… <span class="cd">${left}s</span>`;
  }, 1000);
}

/* ---------------- CARE COUNTER ---------------- */
function updateCare() {
  const el = document.getElementById('care-count');
  if (!userFaction) { el.textContent = '0'; return; }
  el.textContent = carePackages.toLocaleString();
}

/* ---------------- VAULT MODAL ---------------- */
const overlay = document.getElementById('vault-overlay');
function openVault(storeName) {
  userTriggeredVault = true;
  document.getElementById('vault-store').textContent = storeName;
  // confetti
  document.querySelectorAll('.confetti').forEach(c=>c.remove());
  const colors = ['#FFD24A','#FF8A00','#EF4444','#3B82F6','#22C55E','#fff'];
  for (let i=0;i<40;i++){
    const c=document.createElement('div'); c.className='confetti';
    c.style.left = Math.random()*100+'%';
    c.style.background = colors[Math.floor(Math.random()*colors.length)];
    c.style.animationDelay = (Math.random()*1.2)+'s';
    c.style.animationDuration = (1.8+Math.random()*1.4)+'s';
    overlay.querySelector('.vault-box').appendChild(c);
  }
  overlay.classList.add('show');
}
document.getElementById('vault-close').addEventListener('click', () => overlay.classList.remove('show'));
overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show'); });

/* ---------------- TOAST ---------------- */
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2600);
}

/* ---------------- BOOT ---------------- */
renderScoreboard();
renderTapZone();
// seed a few feed items
for (let i=0;i<5;i++) {
  const m = merchants[Math.floor(Math.random()*STORE_COUNT)];
  pushFeed(`User <b>@${rnd(USERNAMES)}</b> tapped at ${m.name}`, leader(m));
}
// Load Google Maps, then start the simulation. If the map can't load
// (missing key / billing), still run the rest of the demo.
loadGoogleMaps()
  .then(() => { initMap(); })
  .catch(showMapError)
  .finally(() => { setInterval(tick, TICK_MS); });
