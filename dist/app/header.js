// noet — общий хедер всех app-страниц: лого (→ главная), навигация, чип профиля
// (аватар+ник → профиль) и кнопка свернуть. Инлайнится в каждую страницу (sandbox CSP
// блокирует внешние скрипты). data-page на <html> помечает активный пункт.
// Свёрнутый хедер прячется, в углу остаётся маленькая стрелка, чтобы открыть обратно.
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]); }); };
  var go = function (h) { if (window.noet && noet.go) noet.go('http://' + h + '/'); else location.href = 'http://' + h + '/'; };
  var here = document.documentElement.getAttribute('data-page') || '';
  var NAV = [['people.nt', 'Люди'], ['relay.nt', 'Лента'], ['dev.nt', 'Разработчикам']];

  var st = document.createElement('style');
  st.textContent =
    '.nhdr{display:flex;align-items:center;gap:.4rem;padding:.7rem 1.1rem;max-width:46rem;margin:0 auto;width:100%}' +
    '.nhdr.hide{display:none}' +
    '.nbrand{cursor:pointer;display:flex;align-items:center;padding:.2rem}.nbrand img{width:28px;height:28px;display:block}' +
    '.nnav{display:flex;gap:.15rem;flex-wrap:wrap}.nnav a{color:#9595a3;font-size:.86rem;padding:.32rem .7rem;border-radius:999px;cursor:pointer;text-decoration:none;white-space:nowrap}.nnav a:hover{color:#f1f1f5}.nnav a.on{color:#f1f1f5;background:#16161f}' +
    '.nme{margin-left:auto;display:inline-flex;align-items:center;gap:.4rem;cursor:pointer;background:#16161f;border:1px solid #2f2f3a;border-radius:999px;padding:.22rem .7rem .22rem .25rem;text-decoration:none;color:#f1f1f5;font-size:.86rem;font-weight:600;max-width:10rem}.nme:hover{border-color:#7c5cff}' +
    '.nme img{width:26px;height:26px;border-radius:50%;flex:0 0 26px}.nme .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.ncol{background:0;border:0;color:#6b6b78;cursor:pointer;font-size:.8rem;padding:.3rem .35rem;line-height:1;border-radius:7px}.ncol:hover{color:#f1f1f5;background:#16161f}.nme+.ncol{margin-left:.1rem}.nnav+.ncol{margin-left:auto}' +
    '.nopen{position:fixed;top:.5rem;right:.6rem;z-index:50;display:none;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;border:1px solid #2f2f3a;background:#16161f;color:#9595a3;cursor:pointer;font-size:.85rem;box-shadow:0 6px 20px rgba(0,0,0,.4)}.nopen:hover{color:#f1f1f5;border-color:#7c5cff}';
  document.head.appendChild(st);

  var hdr = document.createElement('header'); hdr.className = 'nhdr';
  hdr.innerHTML = '<a class="nbrand" id="nbrand" title="Главная"><img src="../logo.svg" alt="noet"></a>' +
    '<nav class="nnav">' + NAV.map(function (n) { return '<a data-h="' + n[0] + '"' + (here === n[0] ? ' class=on' : '') + '>' + n[1] + '</a>'; }).join('') + '</nav>' +
    '<a class="nme" id="nme" title="Моя страница" style="display:none"></a>' +
    '<button class="ncol" id="ncol" title="свернуть шапку" aria-label="свернуть">▲</button>';
  document.body.insertBefore(hdr, document.body.firstChild);

  var opener = document.createElement('button'); opener.className = 'nopen'; opener.id = 'nopen'; opener.title = 'показать меню'; opener.setAttribute('aria-label', 'показать меню'); opener.textContent = '☰';
  document.body.appendChild(opener);

  document.getElementById('nbrand').onclick = function () { go('noet.nt'); };
  hdr.querySelectorAll('[data-h]').forEach(function (a) { a.onclick = function () { go(a.dataset.h); }; });
  var me = document.getElementById('nme'); me.onclick = function () { go('id.nt'); };
  document.getElementById('ncol').onclick = function () { hdr.classList.add('hide'); opener.style.display = 'flex'; };
  opener.onclick = function () { hdr.classList.remove('hide'); opener.style.display = 'none'; };

  function genAv(pk, nm) { var h = 0, seed = pk || nm || '?'; for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0; var hue = h % 360, ch = (nm || '').trim() ? nm.trim()[0].toUpperCase() : ''; return 'data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='32' fill='hsl(" + hue + " 60% 50%)'/><text x='32' y='43' font-family='system-ui' font-size='30' font-weight='600' fill='white' text-anchor='middle'>" + esc(ch) + "</text></svg>"); }
  (async function () {
    if (!window.noet) return;
    try {
      var pk = (await noet.me()).pubkey;
      var profs = await noet.query({ kinds: [0], authors: [pk], limit: 1 }); var prof = {}; try { prof = JSON.parse(profs[0].content); } catch (e) {}
      var claims = (await noet.query({ kinds: [31111], authors: [pk], limit: 20 })).filter(function (e) { return /\.(me|nt)$/i.test(((e.tags.find(function (t) { return t[0] === 'd'; }) || [])[1]) || ''); }).sort(function (a, b) { return b.created_at - a.created_at; });
      var name = claims[0] ? ((claims[0].tags.find(function (t) { return t[0] === 'd'; }) || [])[1]) : ''; var handle = name.replace(/\.(me|nt)$/i, '');
      var dn = prof.name || handle || 'я';
      var av = prof.picture && /^(https?:|data:)/i.test(prof.picture) ? prof.picture : genAv(pk, dn);
      me.innerHTML = '<img src="' + esc(av) + '"><span class=nm>' + esc(dn) + '</span>'; me.style.display = 'inline-flex';
    } catch (e) { /* нет ключа — без чипа */ }
  })();
})();
