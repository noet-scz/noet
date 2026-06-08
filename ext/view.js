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

// Сами забираем HTML со шлюза (CORS *) и кладём в iframe через srcdoc: контент в
// нашем origin, без чужого CSP, поэтому инлайн JS и CSS работают на 100%. sandbox
// без allow-same-origin = изоляция от расширения. <base> чинит относительные ссылки.
async function renderContent(cid, gateways) {
  const frame = $('#frame');
  for (let i = 0; i < gateways.length; i++) {
    const gw = gateways[i].replace('{cid}', cid);
    try {
      const r = await fetch(gw, { signal: AbortSignal.timeout(12000) });
      if (!r.ok) continue;
      let html = await r.text();
      const baseTag = `<base href="${gw}">`;
      if (!/<base\b/i.test(html)) {
        html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + baseTag) : baseTag + html;
      }
      frame.srcdoc = html;
      $('#msg').style.display = 'none';
      frame.hidden = false;
      return;
    } catch { /* следующий шлюз */ }
  }
  showMsg('<h2>Контент недоступен</h2><div>Ни один IPFS-шлюз не ответил. Попробуй позже.</div>');
}

async function main() {
  const cfg = await loadConfig();
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
    showMsg(`<h2>${host}</h2><div>Имя не зарегистрировано в noet.</div>`);
    return;
  }
  showMsg('<div class="spin"></div><div>тяну из IPFS…</div>');
  renderContent(rec.cid, cfg.gateways || []);
}

main();
