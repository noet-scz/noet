// noet — серверлесс-публикация страницы ПРЯМО ИЗ РАСШИРЕНИЯ. Никакого нашего сервера и
// никакого IPFS: маленькая самодостаточная страница хранится в подписанном событии на
// публичных реле, а имя закрепляется заявкой + OpenTimestamps (якорь в Bitcoin). Всё
// делает браузер пользователя своим ключом.
import { schnorr } from './vendor/noble-secp256k1.js';
import { sha256, otsStamp, _util } from './noet-names.js';

const api = globalThis.browser || globalThis.chrome;
const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
const hex = (u) => Array.from(u).map((b) => b.toString(16).padStart(2, '0')).join('');
const h2u = (h) => Uint8Array.from(h.match(/.{2}/g).map((b) => parseInt(b, 16)));
const enc = (s) => new TextEncoder().encode(s);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const getSk = async () => (await api.storage.local.get('noet_sk')).noet_sk || null;
const pubOf = (sk) => hex(schnorr.getPublicKey(h2u(sk)));

async function sign(ev) {
  const sk = await getSk(); if (!sk) throw new Error('в расширении нет ключа');
  ev.pubkey = pubOf(sk); ev.created_at = Math.floor(Date.now() / 1000); ev.tags = ev.tags || []; ev.content = ev.content || '';
  ev.id = hex(sha256(enc(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]))));
  ev.sig = hex(await schnorr.sign(h2u(ev.id), h2u(sk)));
  return ev;
}
function publish(ev) {
  const msg = JSON.stringify(['EVENT', ev]);
  return Promise.allSettled(RELAYS.map((u) => new Promise((res) => {
    let ws; try { ws = new WebSocket(u); } catch { return res(false); }
    const t = setTimeout(() => { try { ws.close(); } catch {} res(false); }, 6000);
    ws.onopen = () => { try { ws.send(msg); } catch {} };
    ws.onmessage = (m) => { try { const a = JSON.parse(m.data); if (a[0] === 'OK' && a[1] === ev.id) { clearTimeout(t); ws.close(); res(!!a[2]); } } catch {} };
    ws.onerror = () => { clearTimeout(t); res(false); };
  }))).then((rs) => rs.filter((r) => r.value).length);
}

// опубликовать страницу целиком в сеть: контент-событие + заявка имени + OTS-proof
async function publishPage(handle, title, html) {
  const name = handle.toLowerCase().replace(/[^a-z0-9-]/g, '') + '.me';
  const content = await sign({ kind: 31002, tags: [['d', name]], content: JSON.stringify({ html, title: title || name, mode: 'html' }) });
  const claim = await sign({ kind: 31111, tags: [['d', name], ['t', 'noet-name'], ['target', '']] });
  const okC = await publish(content);
  await publish(claim);
  // штамп заявки в OTS-календарь → отдельное proof-событие (апгрейдится позже до Bitcoin)
  try { const st = await otsStamp(h2u(claim.id)); if (st) { const pe = await sign({ kind: 31112, tags: [['d', name], ['e', claim.id]], content: st.proof }); await publish(pe); } } catch {}
  return { name, relays: okC };
}

const DEFAULT_HTML = '<!doctype html>\n<html lang="ru"><head><meta charset="utf-8">\n<title>Моя страница</title>\n<style>\n  body{font:18px/1.7 system-ui,sans-serif;background:#0d0d12;color:#ececf2;max-width:40rem;margin:0 auto;padding:3rem 1.2rem}\n  h1{color:#9d8bff}\n  a{color:#9d8bff}\n</style></head>\n<body>\n  <h1>Привет!</h1>\n  <p>Это моя страница в noet. Её нельзя заблокировать или отобрать.</p>\n</body></html>\n';

async function render() {
  const sk = await getSk();
  const app = $('#app');
  if (!sk) {
    app.innerHTML = '<div class="gate">Сначала создай личность: нажми на иконку noet и «Создать личность». Потом обнови эту страницу. <br><br><button class="gho" onclick="location.reload()">Обновить</button></div>';
    return;
  }
  const pk = pubOf(sk);
  app.innerHTML = `
    <label>Имя страницы</label>
    <div class="name-row"><input id="handle" placeholder="напр. alice" autocomplete="off"><span class="suf">.me</span></div>
    <label>Заголовок</label>
    <input id="title" placeholder="как назвать страницу">
    <label>HTML страницы (самодостаточный: стили внутри, без внешних файлов)</label>
    <textarea id="html" spellcheck="false"></textarea>
    <button class="pri" id="pub">Опубликовать в сеть</button>
    <div class="msg" id="msg"></div>
    <div class="msg" style="color:var(--mut);font-size:.82rem;margin-top:.4rem">твой ключ: <code>${esc(pk.slice(0, 24))}…</code></div>`;
  $('#html').value = DEFAULT_HTML;
  $('#pub').onclick = async () => {
    const handle = ($('#handle').value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const title = ($('#title').value || '').trim();
    const html = $('#html').value || '';
    const msg = $('#msg');
    if (!handle) { msg.className = 'msg err'; msg.textContent = 'Впиши имя страницы.'; return; }
    if (!html.trim()) { msg.className = 'msg err'; msg.textContent = 'Страница пустая.'; return; }
    $('#pub').disabled = true; msg.className = 'msg'; msg.textContent = 'подписываю, штампую в Bitcoin-якорь, рассылаю на реле…';
    try {
      const r = await publishPage(handle, title, html);
      msg.className = 'msg ok';
      msg.innerHTML = `Опубликовано на ${r.relays} реле: <a href="http://${esc(r.name)}/" target="_blank">${esc(r.name)}</a>. ` +
        `Имя закрепляется в Bitcoin ~часы (пока провизорное). Сервер не участвовал.`;
    } catch (e) { msg.className = 'msg err'; msg.textContent = (e && e.message) || 'не получилось'; }
    $('#pub').disabled = false;
  };
}
render();
