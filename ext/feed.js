// noet — общая лента сообщества, serverless. Сообщения = kind 1 с тегом t=noet на
// публичных реле. Подпись ключом расширения. Без VPS.
import { schnorr } from './vendor/noble-secp256k1.js';
import { sha256 } from './noet-names.js';

const api = globalThis.browser || globalThis.chrome;
const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
const TOPIC = 'noet';
const hex = (u) => Array.from(u).map((b) => b.toString(16).padStart(2, '0')).join('');
const h2u = (h) => Uint8Array.from(h.match(/.{2}/g).map((b) => parseInt(b, 16)));
const enc = (s) => new TextEncoder().encode(s);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const getSk = async () => (await api.storage.local.get('noet_sk')).noet_sk || null;
function query(filters) {
  const list = Array.isArray(filters) ? filters : [filters]; const seen = new Map();
  const socks = RELAYS.map((u) => { try { return new WebSocket(u); } catch { return null; } }).filter(Boolean);
  return new Promise((res) => {
    let c = 0; const fin = () => { try { socks.forEach((w) => w.close()); } catch {} res([...seen.values()]); };
    const t = setTimeout(fin, 4500);
    socks.forEach((ws) => {
      ws.onopen = () => { try { ws.send(JSON.stringify(['REQ', 'q', ...list])); } catch {} };
      ws.onmessage = (m) => { try { const a = JSON.parse(m.data); if (a[0] === 'EVENT') { if (!seen.has(a[2].id)) seen.set(a[2].id, a[2]); } else if (a[0] === 'EOSE') { ws.close(); if (++c >= socks.length) { clearTimeout(t); fin(); } } } catch {} };
      ws.onerror = () => { if (++c >= socks.length) { clearTimeout(t); fin(); } };
    });
  });
}
async function sign(ev, sk) {
  ev.pubkey = hex(schnorr.getPublicKey(h2u(sk))); ev.created_at = Math.floor(Date.now() / 1000); ev.tags = ev.tags || []; ev.content = ev.content || '';
  ev.id = hex(sha256(enc(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]))));
  ev.sig = hex(await schnorr.sign(h2u(ev.id), h2u(sk))); return ev;
}
function send(ev) {
  const msg = JSON.stringify(['EVENT', ev]);
  return Promise.allSettled(RELAYS.map((u) => new Promise((res) => {
    let ws; try { ws = new WebSocket(u); } catch { return res(); }
    const t = setTimeout(() => { try { ws.close(); } catch {} res(); }, 5000);
    ws.onopen = () => { try { ws.send(msg); } catch {} };
    ws.onmessage = () => { clearTimeout(t); try { ws.close(); } catch {} res(); };
    ws.onerror = () => { clearTimeout(t); res(); };
  })));
}
const IMG = /(https?:\/\/[^\s<]+\.(?:png|jpe?g|gif|webp|avif))/ig;
function content(s) {
  return esc(s).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, (u) => IMG.test(u) ? `<img loading="lazy" src="${u}">` : `<a href="${u}" target="_blank" rel="noreferrer">${u}</a>`);
}
function when(ts) { const d = new Date(ts * 1000); return d.toLocaleDateString('ru') + ' ' + d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }); }

const names = {};
async function who(pk) {
  if (names[pk]) return names[pk]; names[pk] = pk.slice(0, 8) + '…';
  try { const p = (await query({ kinds: [0], authors: [pk], limit: 1 }))[0]; if (p) { const j = JSON.parse(p.content); if (j.name) names[pk] = j.name; } } catch {}
  return names[pk];
}

async function load() {
  const evs = (await query({ kinds: [1], '#t': [TOPIC], limit: 100 })).sort((a, b) => b.created_at - a.created_at);
  if (!evs.length) { $('#list').innerHTML = '<div class="mut">Пока пусто. Будь первым.</div>'; return; }
  let html = '';
  for (const ev of evs) html += `<div class="box"><div><span class="who">@${esc(await who(ev.pubkey))}</span><span class="when">${when(ev.created_at)}</span></div><div class="txt">${content(ev.content)}</div></div>`;
  $('#list').innerHTML = html;
}

async function init() {
  $('#lhome').href = 'http://noet.nt/'; $('#lpeople').href = 'http://people.nt/';
  const sk = await getSk();
  if (!sk) { $('#composer').innerHTML = '<span class="mut">Создай личность в расширении noet, чтобы писать.</span>'; }
  else $('#send').onclick = async () => {
    const txt = ($('#text').value || '').trim(); if (!txt) return;
    const m = $('#m'); m.className = 'msg'; m.textContent = 'Отправляю…';
    try { const ev = await sign({ kind: 1, tags: [['t', TOPIC]], content: txt }, sk); await send(ev); $('#text').value = ''; m.textContent = ''; await load(); }
    catch (e) { m.className = 'msg err'; m.textContent = 'не вышло'; }
  };
  await load();
}
init().catch(() => { $('#list').innerHTML = '<div class="mut">не загрузилось, обнови</div>'; });
