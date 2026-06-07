const PROXY = '127.0.0.1:8090';
const TLD = 'nt';
const BLOG = 'me';

const PAC = `function FindProxyForURL(url, host) {
  if (shExpMatch(host, "*.${TLD}")) return "PROXY ${PROXY}";
  if (shExpMatch(host, "*.${BLOG}")) return "PROXY ${PROXY}";
  return "DIRECT";
}`;

const enable = () => browser.proxy.settings.set({ value: { mode: 'pac_script', pacScript: { data: PAC } }, scope: 'regular' });
const disable = () => browser.proxy.settings.clear({ scope: 'regular' });

async function setState(on) {
  if (on) await enable(); else await disable();
  await browser.storage.local.set({ on });
  browser.browserAction.setBadgeBackgroundColor({ color: on ? '#7c5cff' : '#555' });
  browser.browserAction.setBadgeText({ text: on ? 'ON' : 'OFF' });
  browser.browserAction.setTitle({ title: `noet: ${on ? 'включено' : 'выключено'} (клик: переключить)` });
}

browser.runtime.onInstalled.addListener(() => setState(true));
browser.runtime.onStartup.addListener(async () => {
  const { on } = await browser.storage.local.get('on');
  setState(on !== false);
});
browser.browserAction.onClicked.addListener(async () => {
  const { on } = await browser.storage.local.get('on');
  setState(on === false);
});
