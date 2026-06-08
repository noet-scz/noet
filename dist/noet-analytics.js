// noet-analytics — крошечный логгер событий поверх window.noet (Nostr).
// Подключение в любом сайте/приложении:
//   <script src="https://noet-scz.github.io/noet/dist/noet-analytics.js" data-app="myapp" data-auto="1"></script>
// data-app  — идентификатор приложения (по умолчанию = хост без .me)
// data-auto — если "1", автоматически логировать просмотр страницы
// В коде: noetTrack('тип', {любые: данные}) — например noetTrack('click', {btn:'buy'}).
//
// События подписываются ключом пользователя через расширение noet. Первый раз сайт
// спросит разрешение на подпись. Без расширения noet логирование тихо отключено.
// Дашборд (dash.<твой>.me) читает эти события и показывает активность.
(function () {
  var s = document.currentScript || {};
  var ds = s.dataset || {};
  var app = ds.app || location.hostname.replace(/\.me$/, '') || 'app';
  var TAG = 'noet-an:' + app;

  function track(type, extra) {
    if (!window.noet) return;
    try {
      window.noet.publish({
        kind: 1337,
        tags: [['t', TAG], ['type', String(type)]],
        content: JSON.stringify(Object.assign({ type: String(type), path: location.pathname, ref: document.referrer || '', ts: Date.now() }, extra || {})),
      });
    } catch (e) {}
  }
  window.noetTrack = track;

  if (ds.auto === '1') {
    if (document.readyState !== 'loading') track('view');
    else addEventListener('DOMContentLoaded', function () { track('view'); });
  }
})();
