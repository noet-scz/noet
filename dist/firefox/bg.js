// noet — фоновый скрипт. Ловит переходы на *.nt / *.me и уводит их на нашу
// страницу просмотра (view.html), которая сама резолвит имя и тянет контент из
// IPFS. Кросс-браузерно: Chrome (service worker) и Firefox (event page).
//
// Два механизма: declarativeNetRequest (Chrome, перехват до DNS, без вспышки) и
// webNavigation (надёжно везде, в т.ч. Firefox). getURL даёт верную схему
// (chrome-extension:// или moz-extension://) сам.

const api = globalThis.browser || globalThis.chrome;
const VIEW = api.runtime.getURL('view.html');
const RULE_ID = 1;

async function ensureRule() {
  try {
    if (!api.declarativeNetRequest || !api.declarativeNetRequest.updateDynamicRules) return;
    await api.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [RULE_ID],
      addRules: [{
        id: RULE_ID,
        priority: 1,
        action: { type: 'redirect', redirect: { regexSubstitution: VIEW + '?u=\\0' } },
        condition: { regexFilter: '^https?://[^/]+\\.(nt|me)(/.*)?$', resourceTypes: ['main_frame'] },
      }],
    });
  } catch (e) { /* DNR не поддержан (например Firefox) — работает webNavigation ниже */ }
}

api.runtime.onInstalled.addListener(ensureRule);
if (api.runtime.onStartup) api.runtime.onStartup.addListener(ensureRule);
ensureRule();

// Надёжный механизм для всех браузеров: SW/страница просыпается на навигацию и
// уводит её на view.html (getURL → верная схема расширения).
api.webNavigation.onBeforeNavigate.addListener((d) => {
  if (d.frameId !== 0) return;
  let h; try { h = new URL(d.url).hostname.toLowerCase(); } catch { return; }
  if (!/\.(nt|me)$/.test(h)) return;
  api.tabs.update(d.tabId, { url: VIEW + '?u=' + d.url });
}, { url: [{ hostSuffix: '.nt' }, { hostSuffix: '.me' }] });
