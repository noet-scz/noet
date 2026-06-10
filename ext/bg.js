// noet — фоновый скрипт. Уводит на страницу просмотра ТОЛЬКО зарегистрированные в
// noet имена (служебные + имена из реестра). Реальные домены (t.me, любой .me/.nt
// сайт настоящего интернета) не трогаем. Кросс-браузерно: Chrome и Firefox.

const api = globalThis.browser || globalThis.chrome;
const VIEW = api.runtime.getURL('view.html');
const CONFIG_URL = 'https://noet-scz.github.io/noet/dist/config.json';
const NAMES_URL = 'https://noet-scz.github.io/noet/dist/names.json';

let hosts = new Set();   // какие хосты реально наши

async function loadHosts() {
  const out = new Set();
  try { const c = await (await fetch(CONFIG_URL, { cache: 'no-cache' })).json(); for (const k of Object.keys(c.app_hosts || {})) out.add(k.toLowerCase()); } catch {}
  try { const n = await (await fetch(NAMES_URL, { cache: 'no-cache' })).json(); for (const k of Object.keys(n || {})) out.add(k.toLowerCase()); } catch {}
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
  let set = await knownHosts();
  if (!set.has(h)) set = await loadHosts();   // вдруг имя только что завели — освежаем и проверяем СРАЗУ
  if (set.has(h)) api.tabs.update(d.tabId, { url: VIEW + '?u=' + d.url });
  // незнакомое имя не угоняем: реальные домены (t.me и т.п.) идут своей дорогой
}, { url: [{ hostSuffix: '.nt' }, { hostSuffix: '.me' }] });
