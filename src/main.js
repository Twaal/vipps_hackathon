/* ============================================================
   TÆPPIN' — client-side simulation (Vite)
   ============================================================ */
import './style.css';

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
    // seed scores so the current owner leads (modest lead → flips stay lively)
    FKEYS.forEach(f => scores[f] = 3 + Math.floor(Math.random()*6));
    scores[owner] += 5 + Math.floor(Math.random()*5);
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
let bongs = 0;            // lottery tickets ("bongs") earned from taps
let boxesGrabbed = 0;     // loot boxes the player has captured
let jackpotsRemaining = 5; // student-loan-forgiveness loot boxes left city-wide
const totalTaps = { ruby:0, cobalt:0, jade:0, amber:0 };
const memberCounts = { ruby: 0, cobalt: 0, jade: 0, amber: 0 };
FKEYS.forEach(f => memberCounts[f] = 800 + Math.floor(Math.random()*900));

const leader = m => FKEYS.reduce((a,b) => m.scores[b] > m.scores[a] ? b : a, FKEYS[0]);
const storeCounts = () => { const c={ruby:0,cobalt:0,jade:0,amber:0}; merchants.forEach(m=>c[m.owner]++); return c; };

/* ---------------- FACTION ROSTER (assigned, not chosen) ---------------- */
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
    <div class="members"><b id="mem-${f}">${memberCounts[f].toLocaleString()}</b> members</div>
  `;
  fgrid.appendChild(card);
});

// Factions are assigned at random to keep the war balanced — you can't pick.
function assignRandomFaction(silent = false) {
  const f = FKEYS[Math.floor(Math.random() * FKEYS.length)];
  userFaction = f;
  document.querySelectorAll('.faction-card').forEach((c, i) => c.classList.toggle('selected', FKEYS[i] === f));
  renderJoinZone();
  renderScoreboard();
  updateStats();
  if (!silent) showToast(`🎲 You're on team ${FACTIONS[f].name}!`);
  return f;
}

function renderJoinZone() {
  const tz = document.getElementById('tap-zone');
  if (!userFaction) {
    tz.innerHTML = `<button class="tap-btn enter-btn" id="enter-btn">🎲 JOIN A TEAM <span style="font-size:14px;font-weight:500;">(assigned at random)</span></button>`;
    document.getElementById('enter-btn').addEventListener('click', () => assignRandomFaction());
    return;
  }
  const F = FACTIONS[userFaction];
  tz.innerHTML = `
    <div class="player-hud">
      <div class="hud-faction" style="--fc:${F.color}"><span class="hud-dot"></span>${F.name}</div>
      <div class="hud-stat"><b id="hud-bongs">0</b><span>bongs 🎟️</span></div>
      <div class="hud-stat"><b id="hud-boxes">0</b><span>loot boxes 🎁</span></div>
    </div>
    <button class="tap-btn" id="tap-btn">⚡ TAP NOW <span style="font-size:14px;font-weight:500;">(Simulate Payment)</span></button>
    <div class="hud-hint">Pan the map so a 🎁 store sits in the centre, then tap to grab the loot box.</div>`;
  document.getElementById('tap-btn').addEventListener('click', onTap);
  updateStats();
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

// --- Turf-wars territory: a hex grid, each hex coloured by its nearest store ---
const lats = merchants.map(m => m.lat);
const lngs = merchants.map(m => m.lng);
const PAD_LAT = 0.006, PAD_LNG = 0.012;
const LAT0 = 59.9139;
const KX = Math.cos(LAT0 * Math.PI / 180); // lng→lat distance scale (~0.5 at Oslo)
const HEX_R = 0.0013;                       // hex circumradius, in latitude-degrees

// Build pointy-top hexes covering the store bounds; assign each to its nearest store.
function buildHexes() {
  const latMin = Math.min(...lats) - PAD_LAT, latMax = Math.max(...lats) + PAD_LAT;
  const lngMin = Math.min(...lngs) - PAD_LNG, lngMax = Math.max(...lngs) + PAD_LNG;
  const R = HEX_R;
  const w = Math.sqrt(3) * R;   // column spacing (in X = lng*KX units)
  const vstep = 1.5 * R;        // row spacing (in latitude units)
  const Xmin = lngMin * KX, Xmax = lngMax * KX;
  const storePts = merchants.map(m => ({ id: m.id, x: m.lng * KX, y: m.lat }));
  const hexes = [];
  let row = 0;
  for (let y = latMin; y <= latMax + R; y += vstep, row++) {
    const xOff = (row % 2) ? w / 2 : 0;
    for (let x = Xmin - xOff; x <= Xmax + w; x += w) {
      let best = storePts[0], bd = Infinity;
      for (const s of storePts) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; best = s; } }
      const path = [];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 180 * (60 * i - 30);
        path.push({ lat: y + R * Math.sin(a), lng: (x + R * Math.cos(a)) / KX });
      }
      hexes.push({ storeId: best.id, path });
    }
  }
  return hexes;
}
const hexDefs = buildHexes();

let map = null;
let infoWindow = null;
let openInfoId = null;
const hexesByStore = {};   // storeId -> [google.maps.Polygon]
const markers = {};

let youMarker = null;
let userLocation = { lat: 59.9139, lng: 10.7522 }; // default: central Oslo
let locationReal = false;
let mapReady = false;
let pendingFocus = false;

// distance helpers
function distMeters(a, b) {
  const R = 6371000, toR = x => x * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const fmtDist = m => m < 1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(1)} km`;
const mapsDirUrl = m => `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`;

function hexStyle(owner) {
  const c = FACTIONS[owner].color;
  return { strokeColor: c, strokeOpacity: 0.35, strokeWeight: 1, fillColor: c, fillOpacity: 0.38 };
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
    center: userLocation,
    zoom: 14,
    backgroundColor: '#0E0E10',
    styles: DARK_STYLE,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    gestureHandling: 'greedy', // scroll wheel zooms directly, no Ctrl needed
  });
  infoWindow = new google.maps.InfoWindow();
  infoWindow.addListener('closeclick', () => { openInfoId = null; });

  // territory hexes (drawn under the pins, not individually clickable)
  hexDefs.forEach(h => {
    const owner = merchants[h.storeId].owner;
    const poly = new google.maps.Polygon({ paths: h.path, map, clickable: false, zIndex: 1, ...hexStyle(owner) });
    (hexesByStore[h.storeId] ||= []).push(poly);
  });

  // store pins on top of their territory
  merchants.forEach(m => {
    const mk = new google.maps.Marker({
      position: { lat: m.lat, lng: m.lng },
      map, icon: storeIcon(m.owner), zIndex: 10,
      title: m.name + (m.shielded ? ' 🔒' : ''),
    });
    mk.addListener('click', () => openInfo(m));
    markers[m.id] = mk;
  });

  mapReady = true;
  focusUser();
  if (pendingStage) enterMapStage();
}

/* ---------------- LOCATION & "NEAR YOU" ---------------- */
function focusUser() {
  if (!map) { pendingFocus = true; return; }
  pendingFocus = false;
  map.panTo(userLocation);
  if (!youMarker) {
    youMarker = new google.maps.Marker({
      position: userLocation, map, zIndex: 100,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 },
      label: { text: '📍', fontSize: '32px' },
      title: locationReal ? 'You are here' : 'You (approx. central Oslo)',
    });
  } else {
    youMarker.setPosition(userLocation);
  }
  renderNearby();
}

function requestLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(false);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        // only use a real fix if it's actually near Oslo; otherwise keep the demo city
        if (Math.abs(latitude - 59.9139) < 0.6 && Math.abs(longitude - 10.7522) < 1.2) {
          userLocation = { lat: latitude, lng: longitude };
          locationReal = true;
        }
        resolve(true);
      },
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function renderNearby() {
  const el = document.getElementById('nearby-list');
  if (!el) return;
  const near = merchants
    .map(m => ({ m, d: distMeters(userLocation, m) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 6);
  el.innerHTML = near.map(({ m, d }) => {
    const F = FACTIONS[m.owner];
    const loot = occupiedStores.has(m.id) ? ' <span class="near-loot">🎁</span>' : '';
    return `<div class="near-card" data-id="${m.id}">
      <div class="near-top"><span class="near-dot" style="background:${F.color}"></span><span class="near-name">${m.name}${loot}</span></div>
      <div class="near-meta">${F.name} controls · <b>${fmtDist(d)}</b> away</div>
      <div class="near-actions">
        <span class="near-view">View breakdown</span>
        <a class="near-dir" href="${mapsDirUrl(m)}" target="_blank" rel="noopener">Directions ↗</a>
      </div>
    </div>`;
  }).join('');
  el.querySelectorAll('.near-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.near-dir')) return; // let the directions link open
      const m = merchants[+card.dataset.id];
      if (map) map.panTo({ lat: m.lat, lng: m.lng });
      openInfo(m);
    });
  });
}

function setStoreHexes(m, flash) {
  const hs = hexesByStore[m.id];
  if (!hs) return;
  if (flash) {
    hs.forEach(p => p.setOptions({ strokeColor: '#ffffff', fillColor: '#ffffff', fillOpacity: 0.75 }));
    setTimeout(() => hs.forEach(p => p.setOptions(hexStyle(m.owner))), 300);
  } else {
    hs.forEach(p => p.setOptions(hexStyle(m.owner)));
  }
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
  const loot = occupiedStores.has(m.id)
    ? `<div class="pop-loot">🎁 Loot box here — tap at this store to grab it</div>` : '';
  const dist = fmtDist(distMeters(userLocation, m));
  return `<div class="pop-title">${m.name}</div>
    <div class="pop-owner" style="color:${FACTIONS[m.owner].color}">● Owned by ${FACTIONS[m.owner].name}</div>
    ${rows}
    <div class="pop-shield">${shieldTxt}</div>
    ${loot}
    <div class="pop-dist">📍 ${dist} from you</div>
    <a class="pop-link" href="${mapsDirUrl(m)}" target="_blank" rel="noopener">Open in Google Maps ↗</a>`;
}

function setMarkerOwner(m, animate) {
  const mk = markers[m.id];
  if (mk) mk.setIcon(storeIcon(m.owner));
  setStoreHexes(m, animate);
  updateMarkerTooltip(m);
  if (openInfoId === m.id && infoWindow) infoWindow.setContent(popupHTML(m));
  if (animate && mk) {
    // flash the captured pin white, then settle into the new faction colour
    mk.setIcon({ ...storeIcon(m.owner), fillColor: '#ffffff' });
    setTimeout(() => mk.setIcon(storeIcon(m.owner)), 300);
  }
}

/* ---------------- LOOT BOXES ---------------- */
// Loot boxes spawn on random stores. Anyone can grab one by tapping the store.
// Most are worth NOK 50–100; 5 boxes city-wide hold Student Loan Forgiveness.
let lootBoxes = [];          // { id, storeId, jackpot, marker, timer }
let lootSeq = 0;
const occupiedStores = new Set();
const MAX_BOXES = 6;
const LOOT_TTL = 17000;      // a box disappears if not grabbed in ~17s
let stageActive = false;     // when the full-screen finale is open, freeze loot boxes

function createLootBox(m) {
  if (!map || occupiedStores.has(m.id)) return null;
  // jackpot if any of the 5 remain; otherwise a normal NOK 50–100 box
  const jackpot = jackpotsRemaining > 0 && Math.random() < 0.16;
  if (jackpot) jackpotsRemaining--;
  const marker = new google.maps.Marker({
    position: { lat: m.lat, lng: m.lng },
    map, zIndex: 60,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 },
    label: { text: '🎁', fontSize: '28px' },
    title: 'Loot box — centre the map here and tap to grab it',
    animation: google.maps.Animation.BOUNCE,
  });
  marker.addListener('click', () => openInfo(m));
  const box = { id: ++lootSeq, storeId: m.id, jackpot, marker };
  box.timer = setTimeout(() => despawnLootBox(box, false), LOOT_TTL);
  lootBoxes.push(box);
  occupiedStores.add(m.id);
  updateStats();
  return box;
}

function spawnLootBox() {
  if (!map || lootBoxes.length >= MAX_BOXES) return;
  const free = merchants.filter(m => !occupiedStores.has(m.id));
  if (!free.length) return;
  createLootBox(free[Math.floor(Math.random() * free.length)]);
}

// Ensure there's at least one loot box close to the player (used for the finale).
function ensureNearbyLootBox() {
  if (!map) return null;
  const existing = nearestLootStore();
  if (existing) return existing;
  const target = merchants
    .filter(m => !occupiedStores.has(m.id))
    .sort((a, b) => distMeters(userLocation, a) - distMeters(userLocation, b))[0];
  if (target) createLootBox(target);
  return nearestLootStore();
}

function nearestLootStore() {
  let best = null;
  for (const box of lootBoxes) {
    const m = merchants[box.storeId];
    const d = distMeters(userLocation, m);
    if (!best || d < best.d) best = { box, m, d };
  }
  return best;
}

function despawnLootBox(box, claimed) {
  clearTimeout(box.timer);
  box.marker.setMap(null);
  occupiedStores.delete(box.storeId);
  lootBoxes = lootBoxes.filter(b => b.id !== box.id);
  // a jackpot that vanished unclaimed returns to the city-wide pool
  if (box.jackpot && !claimed) jackpotsRemaining++;
  updateStats();
}

function grabLootBox(box, m) {
  despawnLootBox(box, true);
  boxesGrabbed++;
  if (box.jackpot) {
    openReward('jackpot', m.name);
    pushFeed(`<b>YOU</b> cracked a <b>STUDENT-LOAN loot box</b> at <b>${m.name}</b>! 🎓`, userFaction, { mine: true });
  } else {
    const value = 50 + Math.floor(Math.random() * 11) * 5; // NOK 50–100
    showToast(`🎁 Loot box grabbed — NOK ${value} reward!`);
    pushFeed(`<b>YOU</b> grabbed a loot box at <b>${m.name}</b> — NOK ${value} 💰`, userFaction, { mine: true });
  }
  updateStats();
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
    <span class="mine-tag" style="display:none">YOUR TEAM</span>
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
    pushFeed(`<b>${FACTIONS[newLeader].name}</b> captured <b>${m.name}</b>`, newLeader);
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
  const n = 2 + Math.floor(Math.random()*3); // 2-4 merchants
  for (let k=0;k<n;k++) {
    const m = merchants[Math.floor(Math.random()*merchants.length)];
    const f = pickFactionWeighted();
    const pts = 1 + Math.floor(Math.random()*4);
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
  renderNearby();
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

  // bongs (lottery tickets): 10× on turf you already control
  const controlled = m.owner === userFaction;
  const earned = controlled ? 10 : 1;
  bongs += earned;

  m.scores[userFaction] += 5;           // hero advantage toward a takeover
  totalTaps[userFaction] += 5;

  // grab a loot box if one is sitting on this store
  const box = lootBoxes.find(b => b.storeId === m.id);
  const took = checkTakeover(m);

  if (box) {
    grabLootBox(box, m);                // loot box reward + its own feed line
  } else if (took && m.owner === userFaction) {
    pushFeed(`<b>YOU</b> flipped <b>${m.name}</b>! +${earned} bongs 🎟️`, userFaction, {mine:true});
    showToast(`🔥 You flipped ${m.name}! +${earned} bongs`);
  } else {
    pushFeed(`<b>YOU</b> tapped at <b>${m.name}</b> — +${earned} bongs${controlled ? ' (10× your turf!)' : ''} 🎟️`, userFaction, {mine:true});
    showToast(controlled ? `+${earned} bongs — 10× on your turf! 🎟️` : `+${earned} bong 🎟️`);
  }
  if (openInfoId === m.id && infoWindow) infoWindow.setContent(popupHTML(m));
  renderScoreboard(); updateStats();

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

/* ---------------- LIVE STATS (HUD + reward cards) ---------------- */
function updateStats() {
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTxt('hud-bongs', bongs.toLocaleString());
  setTxt('hud-boxes', boxesGrabbed.toLocaleString());
  setTxt('bong-count', bongs.toLocaleString());
  setTxt('jackpot-left', jackpotsRemaining);
  setTxt('box-count', lootBoxes.length);
}

/* ---------------- REWARD MODAL ---------------- */
const overlay = document.getElementById('vault-overlay');
function openReward(type, storeName) {
  document.getElementById('vault-store').textContent = storeName;
  const core  = document.getElementById('reward-core');
  const title = document.getElementById('reward-title');
  const amt   = document.getElementById('reward-amt');
  if (type === 'jackpot') {
    core.textContent = '🎓';
    title.textContent = 'STUDENT LOAN FORGIVENESS';
    amt.textContent = 'NOK 500 000';
  }
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

/* ---------------- ONBOARDING HEX GRAPHIC ---------------- */
// Draws the same pointy-top hex turf as the live map, coloured by nearest
// faction "capital" so the hexes form contiguous regions, with one boundary
// hex flipping colour to show turf changing hands.
function buildOnbHexGrid(hostId, opts = {}) {
  const host = document.getElementById(hostId);
  if (!host) return;
  const W = 300, H = 168, R = 22;
  const dx = Math.sqrt(3) * R, dy = 1.5 * R;
  const seeds = [
    { f: 'ruby',   x: W * 0.24, y: H * 0.30 },
    { f: 'cobalt', x: W * 0.76, y: H * 0.28 },
    { f: 'amber',  x: W * 0.26, y: H * 0.74 },
    { f: 'jade',   x: W * 0.74, y: H * 0.72 },
  ];
  const hexes = [];
  let row = 0;
  for (let y = R * 0.8; y <= H - R * 0.2; y += dy, row++) {
    const xOff = (row % 2) ? dx / 2 : 0;
    for (let x = xOff + dx / 2; x <= W; x += dx) {
      let nb = seeds[0], n2 = seeds[1], d1 = Infinity, d2 = Infinity;
      for (const s of seeds) {
        const d = (s.x - x) ** 2 + (s.y - y) ** 2;
        if (d < d1) { d2 = d1; n2 = nb; d1 = d; nb = s; }
        else if (d < d2) { d2 = d; n2 = s; }
      }
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 180 * (60 * i - 30);
        pts.push(`${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}`);
      }
      hexes.push({ x, y, owner: nb.f, runner: n2.f, ratio: Math.sqrt(d1) / Math.sqrt(d2), pts: pts.join(' ') });
    }
  }
  // highlight one hex: a flipping boundary hex, or the central "loot drop" hex
  let special = null;
  if (opts.flip) {
    for (const h of hexes) {
      if (h.x < W * 0.28 || h.x > W * 0.72 || h.y < H * 0.28 || h.y > H * 0.72) continue;
      if (!special || h.ratio > special.ratio) special = h;
    }
  } else if (opts.target) {
    let bd = Infinity;
    for (const h of hexes) {
      const d = (h.x - W / 2) ** 2 + (h.y - H / 2) ** 2;
      if (d < bd) { bd = d; special = h; }
    }
  }
  const body = hexes.map(h => {
    const c = FACTIONS[h.owner].color;
    if (h === special && opts.flip) {
      return `<polygon class="hex-flip" points="${h.pts}" fill="${c}" ` +
             `style="--cA:${FACTIONS[h.owner].color};--cB:${FACTIONS[h.runner].color}"/>`;
    }
    if (h === special && opts.target) {
      return `<polygon class="hex-target" points="${h.pts}" fill="${c}"/>`;
    }
    return `<polygon points="${h.pts}" fill="${c}" fill-opacity="0.42" stroke="${c}" stroke-opacity="0.55"/>`;
  }).join('');
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
}

/* ---------------- ONBOARDING (paced pitch) ---------------- */
const onbEl = document.getElementById('onboarding');
let onbStep = 0;
const onbSlides = onbEl ? [...onbEl.querySelectorAll('.onb-slide')] : [];
const onbDotsWrap = document.getElementById('onb-dots');
let pendingStage = false;

if (onbDotsWrap) {
  onbDotsWrap.innerHTML = onbSlides.map((_, i) => `<span class="onb-dot${i === 0 ? ' on' : ''}"></span>`).join('');
}
const onbDots = onbDotsWrap ? [...onbDotsWrap.querySelectorAll('.onb-dot')] : [];

function showOnbStep(i) {
  onbStep = Math.max(0, Math.min(i, onbSlides.length - 1));
  onbSlides.forEach((s, idx) => s.classList.toggle('active', idx === onbStep));
  onbDots.forEach((d, idx) => d.classList.toggle('on', idx === onbStep));
  const cur = onbSlides[onbStep];
  if (cur && cur.dataset.reveal === 'faction' && !userFaction) onbRevealFaction();
  notifyParent({ type: 'taeppin:onb', step: onbStep, total: onbSlides.length });
}

function notifyParent(msg) {
  if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*');
}

// onboarding still on screen?
function onbVisible() {
  return onbEl && document.body.contains(onbEl) && !onbEl.classList.contains('hide');
}

// arrow-key / parent-driven navigation through the pitch
function onbNavigate(dir) {
  if (!onbVisible()) return;
  if (dir > 0 && onbStep >= onbSlides.length - 1) finishOnboarding();
  else showOnbStep(onbStep + dir);
}
window.__onbNav = onbNavigate; // called by the presenter page (same-origin)
window.__onbGoto = (i) => showOnbStep(i); // jump to a slide (used by the PDF exporter)
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') { if (onbVisible()) { e.preventDefault(); onbNavigate(1); } }
  else if (e.key === 'ArrowLeft') { if (onbVisible()) { e.preventDefault(); onbNavigate(-1); } }
});

function onbRevealFaction() {
  const f = assignRandomFaction(true);
  const F = FACTIONS[f];
  const el = document.getElementById('onb-faction');
  if (el) el.innerHTML = `
    <div class="onb-badge" style="--fc:${F.color}">${F.name[0]}</div>
    <div class="onb-fname">You are on team <span style="color:${F.color}">${F.name}</span></div>`;
}

function finishOnboarding() {
  if (!userFaction) assignRandomFaction(true); // covers the "skip intro" path
  if (onbEl) {
    onbEl.classList.add('hide');
    setTimeout(() => onbEl.remove(), 450);
  }
  enterMapStage();
}

/* ---------------- FULL-SCREEN MAP FINALE ---------------- */
function enterMapStage() {
  if (!mapReady) { pendingStage = true; focusUser(); return; }
  pendingStage = false;
  stageActive = true; // freeze loot boxes so the nearest one (and its route) stays put
  notifyParent({ type: 'taeppin:stage' });
  document.body.classList.add('map-stage');
  google.maps.event.trigger(map, 'resize');
  focusUser();
  const near = ensureNearbyLootBox();
  // stop every current box from expiring while the finale is on screen
  lootBoxes.forEach(b => clearTimeout(b.timer));
  // frame the player and the nearby loot box together
  if (near) {
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(userLocation);
    bounds.extend({ lat: near.m.lat, lng: near.m.lng });
    map.fitBounds(bounds, 120);
  }
  showStageCTA(near);
}

// large QR + call-to-action over the finale map (no Google Maps hand-off)
function showStageCTA(near) {
  const el = document.getElementById('stage-cta');
  if (!el) return;
  const sub = el.querySelector('.stage-store');
  if (sub) sub.textContent = near ? near.m.name : 'a store near you';
  el.classList.add('show');
}

function exitMapStage() {
  stageActive = false; // loot boxes resume spawning/expiring on the dashboard map
  document.body.classList.remove('map-stage');
  const el = document.getElementById('stage-cta');
  if (el) el.classList.remove('show');
  if (map) {
    google.maps.event.trigger(map, 'resize');
    map.setCenter(userLocation);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

if (onbEl) {
  onbEl.querySelectorAll('.onb-next').forEach(b => b.addEventListener('click', () => showOnbStep(onbStep + 1)));
  const skipIntro = document.getElementById('onb-skipintro');
  if (skipIntro) skipIntro.addEventListener('click', () => showOnbStep(onbSlides.length - 1));
  const locBtn = document.getElementById('onb-locate');
  if (locBtn) locBtn.addEventListener('click', async () => {
    locBtn.disabled = true; locBtn.textContent = '📍 Locating…';
    await requestLocation();
    finishOnboarding();
  });
  const skipBtn = document.getElementById('onb-skip');
  if (skipBtn) skipBtn.addEventListener('click', finishOnboarding);
}
const stageExit = document.getElementById('stage-exit');
if (stageExit) stageExit.addEventListener('click', exitMapStage);

/* ---------------- BOOT ---------------- */
renderScoreboard();
renderJoinZone();
updateStats();
buildOnbHexGrid('onb-hexgrid', { flip: true });
buildOnbHexGrid('onb-hexgrid-loot', { target: true });
// seed a few feed items
for (let i=0;i<5;i++) {
  const m = merchants[Math.floor(Math.random()*STORE_COUNT)];
  pushFeed(`User <b>@${rnd(USERNAMES)}</b> tapped at ${m.name}`, leader(m));
}
// Load Google Maps, then start the simulation + loot-box spawns. If the map
// can't load (missing key / billing), still run the rest of the demo.
loadGoogleMaps()
  .then(() => {
    initMap();
    // seed a couple of boxes, then keep topping them up (paused during the finale)
    spawnLootBox(); spawnLootBox();
    setInterval(() => { if (!stageActive && Math.random() < 0.7) spawnLootBox(); }, 4000);
  })
  .catch(showMapError)
  .finally(() => { setInterval(tick, TICK_MS); });
