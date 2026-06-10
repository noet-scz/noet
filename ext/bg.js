// noet — фоновый скрипт. Уводит на страницу просмотра ТОЛЬКО наши имена (служебные +
// из реестра + заявленные на публичных реле). Реальные домены (t.me, реальный nyx.me и
// любой .me/.nt сайт обычного интернета) не трогаем. Кросс-браузерно: Chrome и Firefox.

const api = globalThis.browser || globalThis.chrome;
const VIEW = api.runtime.getURL('view.html');
const CONFIG_URL = 'https://noet-scz.github.io/noet/dist/config.json';
const NAMES_URL = 'https://noet-scz.github.io/noet/dist/names.json';
let relays = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];

let hosts = new Set();   // какие хосты реально наши

// serverless-директория: имена-заявки (kind 31111, t=noet-name) с публичных реле.
// Благодаря ей имя перехватывается БЕЗ реестра, как только кто-то его заявил.
function relayClaimNames() {
  return new Promise((resolve) => {
    const names = new Set();
    let socks; try { socks = relays.map((u) => new WebSocket(u)); } catch { return resolve(names); }
    let closed = 0;
    const fin = () => { try { socks.forEach((w) => w.close()); } catch {} resolve(names); };
    const t = setTimeout(fin, 4500);
    socks.forEach((ws) => {
      ws.onopen = () => { try { ws.send(JSON.stringify(['REQ', 'n', { kinds: [31111], '#t': ['noet-name'], limit: 2000 }])); } catch {} };
      ws.onmessage = (m) => {
        try {
          const a = JSON.parse(m.data);
          if (a[0] === 'EVENT') { const d = ((a[2].tags || []).find((x) => x[0] === 'd') || [])[1]; if (d && /^[a-z0-9.-]+\.(nt|me)$/i.test(d) && !/^p\d+-[0-9a-f]{5,}\.(me|nt)$/i.test(d)) names.add(d.toLowerCase()); }
          else if (a[0] === 'EOSE') { ws.close(); if (++closed >= socks.length) { clearTimeout(t); fin(); } }
        } catch {}
      };
      ws.onerror = () => { if (++closed >= socks.length) { clearTimeout(t); fin(); } };
    });
  });
}

async function loadHosts() {
  const out = new Set();
  try { const c = await (await fetch(CONFIG_URL, { cache: 'no-cache' })).json(); for (const k of Object.keys(c.app_hosts || {})) out.add(k.toLowerCase()); if (Array.isArray(c.relays) && c.relays.length) relays = c.relays; } catch {}
  try { const n = await (await fetch(NAMES_URL, { cache: 'no-cache' })).json(); for (const k of Object.keys(n || {})) out.add(k.toLowerCase()); } catch {}
  try { (await relayClaimNames()).forEach((n) => out.add(n)); } catch {}   // имена с реле (serverless)
  if (out.size) { hosts = out; try { await api.storage.local.set({ ihosts: [...out] }); } catch {} }
  else { try { const { ihosts } = await api.storage.local.get('ihosts'); if (ihosts) hosts = new Set(ihosts); } catch {} }
  return hosts;
}
async function knownHosts() {
  if (!hosts.size) { try { const { ihosts } = await api.storage.local.get('ihosts'); if (ihosts) hosts = new Set(ihosts); } catch {} }
  return hosts;
}

api.runtime.onInstalled.addListener(loadHosts);
if (api.runtime.onStartup) api.runtime.onStartup.addListener(loadHosts);
loadHosts();

api.webNavigation.onBeforeNavigate.addListener(async (d) => {
  if (d.frameId !== 0) return;
  let h; try { h = new URL(d.url).hostname.toLowerCase(); } catch { return; }
  if (!/\.(nt|me)$/.test(h)) return;          // быстрый отсев
  const set = await knownHosts();
  if (set.has(h)) { api.tabs.update(d.tabId, { url: VIEW + '?u=' + d.url }); return; }
  // имя неизвестно: пропускаем (это реальный домен), но фоном освежаем список — вдруг
  // это только что заявленное имя. Навигацию НЕ блокируем (иначе тормозим чужие домены).
  loadHosts();
}, { url: [{ hostSuffix: '.nt' }, { hostSuffix: '.me' }] });
