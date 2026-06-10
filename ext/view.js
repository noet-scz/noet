// noet — резолвер+рендер в странице расширения. Замороженный код, всё изменяемое
// (адрес реестра, список шлюзов, имена) тянется снаружи в рантайме.

const api = globalThis.browser || globalThis.chrome;   // Firefox: browser.*, Chrome: chrome.*
const REMOTE_CONFIG = 'https://noet-scz.github.io/noet/dist/config.json';
const $ = (s) => document.querySelector(s);

// исходный URL пришёл как ...view.html?u=<полный URL>
function originalUrl() {
  const i = location.href.indexOf('?u=');
  return i < 0 ? '' : location.href.slice(i + 3);
}
function parseTarget(raw) {
  try { const u = new URL(raw); return { host: u.hostname.toLowerCase(), path: u.pathname + u.search, full: raw }; }
  catch { return { host: '', path: '/', full: raw }; }
}

async function loadConfig() {
  try {
    const r = await fetch(REMOTE_CONFIG, { signal: AbortSignal.timeout(5000), cache: 'no-cache' });
    if (r.ok) { const c = await r.json(); await api.storage.local.set({ cfg: c }); return c; }
  } catch {}
  const { cfg } = await api.storage.local.get('cfg');         // прошлый удачный
  if (cfg) return cfg;
  return fetch(api.runtime.getURL('config.default.json')).then((r) => r.json()); // вшитый запасной
}

async function fetchNames(cfg) {
  for (const src of cfg.name_sources || []) {
    try {
      const r = await fetch(src, { signal: AbortSignal.timeout(6000), cache: 'no-cache' });
      if (!r.ok) continue;
      const j = await r.json();
      await api.storage.local.set({ names: j, names_ts: Date.now() });
      return j;
    } catch {}
  }
  const { names } = await api.storage.local.get('names');     // офлайн-кэш
  return names || {};
}

function setName(host) {
  const dot = host.lastIndexOf('.');
  $('#name').innerHTML = dot > 0
    ? host.slice(0, dot) + '<span class="tld">' + host.slice(dot) + '</span>'
    : host;
}
function showMsg(html) { $('#msg').style.display = 'flex'; $('#msg').innerHTML = html; }

// ---- мост window.noet / window.nostr для контента в sandbox-рендере ----
// Публичные шлюзы либо не выполняют JS (dweb.link), либо не находят наш контент
// (w3s.link, IPNI). Поэтому забираем БАЙТЫ страницы со шлюза (он их отдаёт) и рисуем
// в sandbox-странице расширения (там CSP разрешает JS). Личность и реле страница
// получает через мост сюда: подпись ключом расширения + публичные wss-реле.
let RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];   // публичные реле — дом данных (P2); конфиг может переопределить
const _K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
function sha256hex(str){const rotr=(x,n)=>(x>>>n)|(x<<(32-n));const bytes=new TextEncoder().encode(str),l=bytes.length;const withOne=l+1,pad=(56-(withOne%64)+64)%64,total=withOne+pad+8;const m=new Uint8Array(total);m.set(bytes);m[l]=0x80;const dv=new DataView(m.buffer);dv.setUint32(total-8,Math.floor((l*8)/0x100000000),false);dv.setUint32(total-4,(l*8)>>>0,false);let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;const w=new Uint32Array(64);for(let i=0;i<total;i+=64){for(let t=0;t<16;t++)w[t]=dv.getUint32(i+t*4,false);for(let t=16;t<64;t++){const s0=rotr(w[t-15],7)^rotr(w[t-15],18)^(w[t-15]>>>3);const s1=rotr(w[t-2],17)^rotr(w[t-2],19)^(w[t-2]>>>10);w[t]=(w[t-16]+s0+w[t-7]+s1)>>>0;}let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;for(let t=0;t<64;t++){const S1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^(~e&g);const t1=(h+S1+ch+_K[t]+w[t])>>>0;const S0=rotr(a,2)^rotr(a,13)^rotr(a,22),maj=(a&b)^(a&c)^(b&c);const t2=(S0+maj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;}const hx=(x)=>('00000000'+(x>>>0).toString(16)).slice(-8);return hx(h0)+hx(h1)+hx(h2)+hx(h3)+hx(h4)+hx(h5)+hx(h6)+hx(h7);}
const u8hex = (u) => Array.from(u).map((b) => b.toString(16).padStart(2, '0')).join('');
const hex2u8 = (h) => Uint8Array.from(h.match(/.{2}/g).map((b) => parseInt(b, 16)));
let _sc = null;
async function schnorr() { if (!_sc) _sc = (await import(api.runtime.getURL('vendor/noble-secp256k1.js'))).schnorr; return _sc; }
async function keyHex() { return (await api.storage.local.get('noet_sk')).noet_sk || null; }
async function getPub() { const sk = await keyHex(); if (!sk) throw new Error('в noet нет ключа'); return u8hex((await schnorr()).getPublicKey(hex2u8(sk))); }
async function signEv(ev) {
  const sk = await keyHex(); if (!sk) throw new Error('в noet нет ключа');
  const s = await schnorr(); ev = ev || {};
  ev.pubkey = u8hex(s.getPublicKey(hex2u8(sk)));
  ev.created_at = ev.created_at || Math.floor(Date.now() / 1000); ev.tags = ev.tags || []; ev.content = ev.content || '';
  ev.id = sha256hex(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]));
  ev.sig = u8hex(await s.sign(hex2u8(ev.id), hex2u8(sk)));
  return ev;
}
async function relayPublish(ev) {
  const signed = await signEv(ev); const msg = JSON.stringify(['EVENT', signed]);
  await Promise.allSettled(RELAYS.map((u) => new Promise((res) => {
    let ws; try { ws = new WebSocket(u); } catch { return res(); }
    const t = setTimeout(() => { try { ws.close(); } catch {} res(); }, 4500);
    ws.onopen = () => { try { ws.send(msg); } catch {} };
    ws.onmessage = (m) => { try { if (JSON.parse(m.data)[0] === 'OK') { clearTimeout(t); ws.close(); res(); } } catch {} };
    ws.onerror = () => { clearTimeout(t); res(); };
  })));
  return signed;
}
function relayQuery(filters, opts) {
  const list = Array.isArray(filters) ? filters : [filters]; const seen = new Map();
  const socks = RELAYS.map((u) => { try { return new WebSocket(u); } catch { return null; } }).filter(Boolean);
  return new Promise((res) => {
    let closed = 0;
    const fin = () => { try { socks.forEach((w) => w.close()); } catch {} res([...seen.values()].sort((a, b) => b.created_at - a.created_at)); };
    const t = setTimeout(fin, (opts && opts.timeout) || 4500);
    socks.forEach((ws) => {
      ws.onopen = () => { try { ws.send(JSON.stringify(['REQ', 'q', ...list])); } catch {} };
      ws.onmessage = (m) => { try { const a = JSON.parse(m.data); if (a[0] === 'EVENT') { const ev = a[2]; if (ev && !seen.has(ev.id)) seen.set(ev.id, ev); } else if (a[0] === 'EOSE') { ws.close(); if (++closed >= socks.length) { clearTimeout(t); fin(); } } } catch {} };
      ws.onerror = () => { if (++closed >= socks.length) { clearTimeout(t); fin(); } };
    });
  });
}
async function handleCall(apiName, method, params) {
  if (apiName === 'nostr') { if (method === 'getPublicKey') return await getPub(); if (method === 'signEvent') return await signEv(params); return {}; }
  if (apiName === 'noet') { if (method === 'me') return { pubkey: await getPub() }; if (method === 'publish') return await relayPublish(params); if (method === 'query') return await relayQuery(params[0], params[1] || {}); }
  throw new Error('неизвестный вызов');
}

// исходник SDK примитивов — один раз тянем из пакета расширения и вкладываем в рендер,
// чтобы у контента был тот же window.noet, что и на обычных страницах
let _sdkSrc = null;
async function sdkSrc() {
  if (_sdkSrc == null) { try { _sdkSrc = await (await fetch(api.runtime.getURL('noet-primitives.js'))).text(); } catch { _sdkSrc = ''; } }
  return _sdkSrc;
}

let _pendingDoc = null;
window.addEventListener('message', async (e) => {
  const d = e.data;
  if (d && d.__noetRender === 'ready') {
    if (_pendingDoc) { try { e.source.postMessage({ __noetRender: 'doc', html: _pendingDoc.html, base: _pendingDoc.base, sdk: _pendingDoc.sdk }, '*'); } catch {} }
    $('#msg').style.display = 'none'; $('#frame').hidden = false;
    return;
  }
  if (d && d.__noetCall) {
    let result, error;
    try { result = await handleCall(d.api, d.method, d.params); } catch (err) { error = (err && err.message) || 'ошибка'; }
    try { e.source.postMessage({ __noetRes: 1, id: d.id, result, error }, '*'); } catch {}
  }
});

// забрать байты страницы со шлюза (он их отдаёт, даже если не выполняет JS) и
// отрисовать в sandbox-странице render.html, где JS работает
async function renderContent(cid, gateways) {
  let html = null, base = '';
  for (let i = 0; i < gateways.length; i++) {
    const gw = gateways[i].replace('{cid}', cid);
    try {
      const r = await fetch(gw, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      const txt = await r.text();
      if (txt && /<[a-z!/]/i.test(txt)) { html = txt; base = gw; break; }
    } catch { /* следующий шлюз */ }
  }
  if (html == null) { showMsg('<h2>Контент недоступен</h2><div>Контент ещё расходится по сети IPFS, или шлюзы недоступны. Обнови через минуту.</div>'); return; }
  _pendingDoc = { html, base, sdk: await sdkSrc() };
  $('#frame').src = api.runtime.getURL('render.html');
}

// P2: «вид, а не хранилище». Указатель страницы живёт ещё и на публичных реле как
// подписанное событие 31002 (d=имя, content={cid,…}), поэтому обновления и другой
// экземпляр видят его БЕЗ нашего сервера. Берём свежий указатель владельца, если есть.
// P5: бессерверный резолв имени по заявкам на публичных реле (OTS-очерёдность).
// Нужен, когда имени нет в индексе-зеркале (или реестр выключен совсем).
let _namesMod = null;
async function namesMod() { if (!_namesMod) _namesMod = await import(api.runtime.getURL('noet-names.js')); return _namesMod; }
async function resolveNameViaRelays(name) {
  try { const mod = await namesMod(); return await mod.resolveName(name, { query: (f) => relayQuery(f, { timeout: 3500 }) }); }
  catch { return null; }
}

async function relayRecordCid(name, owner) {
  if (!owner) return null;
  try {
    const evs = await relayQuery({ kinds: [31002], authors: [owner], '#d': [name], limit: 1 }, { timeout: 3000 });
    const ev = evs && evs[0];
    if (!ev) return null;
    let cid = null; try { cid = JSON.parse(ev.content || '{}').cid; } catch {}
    if (!cid) cid = (ev.tags || []).filter((t) => t[0] === 'cid').map((t) => t[1])[0] || null;
    return cid || null;
  } catch { return null; }
}

async function main() {
  const cfg = await loadConfig();
  if (Array.isArray(cfg.relays) && cfg.relays.length) RELAYS = cfg.relays;
  const { host, path } = parseTarget(originalUrl());
  const regBase = (cfg.registry || '').replace(/\/$/, '');
  $('#home').addEventListener('click', (e) => { e.preventDefault(); location.href = regBase + '/'; });

  if (!host) { showMsg('<h2>noet</h2><div>Не разобрал адрес.</div>'); return; }

  // приложение (дом/поиск/личность/реле) — это обычные http-страницы реестра, где
  // вход, аккаунт и реле работают нативно (http-страница → http-API + ws, один origin,
  // без mixed-content и без домена). Расширение только переводит туда вкладку.
  const app = (cfg.app_hosts || {})[host];
  if (app && app[0] === '/') { location.href = regBase + app; return; }

  // контент по имени
  setName(host);
  showMsg('<div class="spin"></div><div>резолвлю имя…</div>');
  const names = await fetchNames(cfg);
  const rec = names[host];
  if (!rec || !rec.cid) {
    // имени нет в индексе-зеркале → бессерверный путь: заявки на публичных реле + OTS
    showMsg('<div class="spin"></div><div>резолвлю без сервера…</div>');
    const resolved = await resolveNameViaRelays(host);
    if (resolved && resolved.owner) {
      let cid = resolved.target || (await relayRecordCid(host, resolved.owner));
      if (cid) { showMsg('<div class="spin"></div><div>тяну из IPFS…</div>'); renderContent(cid, cfg.gateways || []); return; }
    }
    showMsg(`<h2>${host}</h2><div>Имя не зарегистрировано в noet.</div>`);
    return;
  }
  showMsg('<div class="spin"></div><div>тяну из IPFS…</div>');
  renderContent(rec.cid, cfg.gateways || []);   // мгновенно: CID из индекса имён (быстрый путь)
  // фоном: вдруг на публичных реле есть более свежий указатель (обновление автора или
  // другой экземпляр) — тогда переключаемся на него. Нет регресса скорости: рендер уже идёт.
  relayRecordCid(host, rec.owner).then((cid) => { if (cid && cid !== rec.cid) renderContent(cid, cfg.gateways || []); }).catch(() => {});
}

main();
