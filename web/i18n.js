// noet — i18n. Один словарь, window.t(key). Дефолт RU, выбор хранится в localStorage.
(function () {
  const DICT = {
    ru: {
      guest: 'Гость', login: 'Войти', logout: 'Выйти', account: 'Аккаунт',
      search_nav: 'Поиск', relay_nav: 'Реле', back: 'Назад',
      // search
      search_ph: 'искать в noet', searching: 'ищу…', nothing: 'ничего не найдено',
      // relay
      relay_title: 'Реле', compose_ph: 'написать в реле…', send: 'Отправить',
      reply: 'Ответить', reply_to: 'в ответ', cancel: 'Отмена',
      gate_read: 'Войди, чтобы видеть реле.', today: 'сегодня', yesterday: 'вчера',
      // account
      acc_welcome: 'Личность noet', acc_guest_hint: 'Ты не вошёл. Личность это твой ключ, без почты и паролей.',
      ext_create_hint: 'Создай личность в расширении noet: нажми на иконку noet в браузере, затем «Создать личность». После этого обнови эту страницу.', reload: 'Обновить',
      create_identity: 'Создать личность', have_key: 'У меня уже есть ключ', import_key: 'Импортировать ключ',
      import_ph: 'приватный ключ (64 hex)', key_ready: 'Ключ готов и сохранён в этом браузере.',
      download_backup: 'Скачать бэкап', backup_warn: 'Сохрани бэкап. Потеряешь ключ — потеряешь личность.',
      choose_handle: 'Выбери имя в noet', handle_ph: '2–20 символов: a-z 0-9 _',
      register_btn: 'Зарегистрироваться',
      display_name: 'Отображаемое имя', dname_ph: 'как тебя показывать',
      avatar_lbl: 'Аватар: ссылка на картинку или эмодзи', avatar_ph: '🜂 или https://…',
      about_lbl: 'О себе', about_ph: 'пара слов', save: 'Сохранить', saved: 'Сохранено',
      your_page: 'Твоя страница', edit_page: 'Редактировать',
      page_title_ph: 'заголовок',
      page_body_ph: 'Пиши свободно. Пустая строка — новый абзац. Строка с # — заголовок.',
      publish_btn: 'Опубликовать', published: 'Опубликовано:',
      show_backup: 'Скачать бэкап ключа', forget_key: 'Забыть ключ в этом браузере',
      forget_confirm: 'Забыть ключ в этом браузере? Без бэкапа личность не вернуть.',
      key_label: 'ключ',
      // errors
      err_bad_sig: 'Подпись не прошла.', err_bad_challenge: 'Срок входа истёк, попробуй ещё раз.',
      err_bad_handle: 'Имя: 2–20 символов a-z 0-9 _.', err_handle_taken: 'Это имя уже занято.',
      err_invite_invalid: 'Инвайт неверный или уже использован.', err_need_login: 'Сначала войди.',
      err_name_format: 'Имя: только буквы, цифры и дефис.', err_name_taken: 'Имя занято другим участником.',
      err_no_key: 'В этом браузере нет ключа.',
      err_network: 'Нет связи, попробуй ещё раз.', err_generic: 'Что-то пошло не так, попробуй ещё раз.',
      err_empty: 'Страница пустая.',
    },
    en: {
      guest: 'Guest', login: 'Sign in', logout: 'Sign out', account: 'Account',
      search_nav: 'Search', relay_nav: 'Relay', back: 'Back',
      search_ph: 'search noet', searching: 'searching…', nothing: 'nothing found',
      relay_title: 'Relay', compose_ph: 'write to the relay…', send: 'Send',
      reply: 'Reply', reply_to: 'replying to', cancel: 'Cancel',
      gate_read: 'Sign in to see the relay.', today: 'today', yesterday: 'yesterday',
      acc_welcome: 'noet identity', acc_guest_hint: 'You are not signed in. Your identity is a key, no email or passwords.',
      ext_create_hint: 'Create your identity in the noet extension: click the noet icon in the browser, then "Create identity". Then reload this page.', reload: 'Reload',
      create_identity: 'Create identity', have_key: 'I already have a key', import_key: 'Import key',
      import_ph: 'private key (64 hex)', key_ready: 'Key is ready and stored in this browser.',
      download_backup: 'Download backup', backup_warn: 'Save the backup. Lose the key, lose the identity.',
      choose_handle: 'Choose your handle', handle_ph: '2–20 chars: a-z 0-9 _',
      register_btn: 'Register',
      display_name: 'Display name', dname_ph: 'how to show you',
      avatar_lbl: 'Avatar: image link or emoji', avatar_ph: '🜂 or https://…',
      about_lbl: 'About', about_ph: 'a few words', save: 'Save', saved: 'Saved',
      your_page: 'Your page', edit_page: 'Edit',
      page_title_ph: 'title',
      page_body_ph: 'Write freely. Blank line = new paragraph. Line with # = heading.',
      publish_btn: 'Publish', published: 'Published:',
      show_backup: 'Download key backup', forget_key: 'Forget key on this device',
      forget_confirm: 'Forget the key on this device? Without a backup the identity is gone.',
      key_label: 'key',
      err_bad_sig: 'Signature check failed.', err_bad_challenge: 'Login expired, try again.',
      err_bad_handle: 'Handle: 2–20 chars a-z 0-9 _.', err_handle_taken: 'That handle is taken.',
      err_invite_invalid: 'Invite is invalid or already used.', err_need_login: 'Sign in first.',
      err_name_format: 'Name: letters, digits and hyphens only.', err_name_taken: 'Name taken by another member.',
      err_no_key: 'No key in this browser.',
      err_network: 'Network error, try again.', err_generic: 'Something went wrong, try again.',
      err_empty: 'Page is empty.',
    },
  };
  let lang = localStorage.getItem('noet_lang');
  if (!lang) lang = (navigator.language || 'ru').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  window.noetLang = () => lang;
  window.setLang = (l) => { lang = DICT[l] ? l : 'ru'; localStorage.setItem('noet_lang', lang); window.dispatchEvent(new Event('noetlang')); };
  window.t = (k) => (DICT[lang] && DICT[lang][k]) || DICT.ru[k] || k;
})();
