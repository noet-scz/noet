// noet — фоновый воркер. Единственная задача: ловить переходы на *.nt / *.me и
// уводить их на нашу страницу просмотра (view.html), которая сама резолвит имя и
// тянет контент из IPFS. Расширение замороженное: ничего изменяемого тут нет,
// все настройки и данные view.html берёт снаружи в рантайме.

const RULE_ID = 1;

async function ensureRule() {
  const base = `chrome-extension://${chrome.runtime.id}/view.html?u=`;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: [{
      id: RULE_ID,
      priority: 1,
      action: { type: 'redirect', redirect: { regexSubstitution: base + '\\0' } },
      condition: {
        regexFilter: '^https?://[^/]+\\.(nt|me)(/.*)?$',
        resourceTypes: ['main_frame'],
      },
    }],
  });
}

chrome.runtime.onInstalled.addListener(ensureRule);
chrome.runtime.onStartup.addListener(ensureRule);
ensureRule();

// Фоллбэк на случай холодного старта (динамическое правило ещё не встало):
// SW просыпается на навигацию и уводит её на view.html сам.
chrome.webNavigation.onBeforeNavigate.addListener((d) => {
  if (d.frameId !== 0) return;
  let h; try { h = new URL(d.url).hostname.toLowerCase(); } catch { return; }
  if (!/\.(nt|me)$/.test(h)) return;
  chrome.tabs.update(d.tabId, { url: chrome.runtime.getURL('view.html') + '?u=' + d.url });
}, { url: [{ hostSuffix: '.nt' }, { hostSuffix: '.me' }] });
