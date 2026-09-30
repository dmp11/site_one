/**
 * Google Apps Script — приём заявок с лендинга в Google Таблицу
 * ------------------------------------------------------------------
 * ПОДКЛЮЧЕНИЕ
 *  1. Откройте таблицу, куда должны падать заявки.
 *  2. Меню «Расширения» → «Apps Script».
 *  3. Удалите содержимое Code.gs и вставьте этот файл целиком.
 *  4. «Настроить» (шестерёнка) → в поле «Ячейка для журнала выполнения»
 *     укажите, например, Лист1!A1 и нажмите «Сохранить».
 *  5. Выберите функцию doPost → «Запустить» (выдаст разрешения — согласуйтесь).
 *  6. Меню «Развернуть» → «Новое развёртывание»:
 *       Тип        → Веб-приложение
 *       Выполнять  → от себя
 *       Кто имеет доступ → «Любой»  (именно «Любой», не «Любой с аккаунтом Google»)
 *  7. Скопируйте URL вида https://script.google.com/macros/s/AKfy.../exec
 *     и вставьте его в assets/js/main.js → LEAD_ENDPOINT.
 *
 * ВАЖНО
 *  • Каждая новая правка скрипта требует «Развернуть» → «Управление развёртываниями»
 *    → «Редактировать» → «Новая версия». Иначе правки не применятся.
 *  • Не публикуйте URL таблицы — он и так приватный, данные приходят только на сервер.
 */

var SHEET_NAME = 'Заявки';        // имя листа (создастся автоматически)
var HEADERS = [
  'Дата', 'Время', 'Имя', 'Телефон', 'Цена', 'Проект',
  'Источник', 'Страница', 'UTM source', 'UTM medium', 'UTM campaign', 'User-Agent'
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // honeypot: бот заполнил скрытое поле — тихо отбрасываем
    if (data.company) return json({ ok: true, skipped: 'bot' });

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

    // шапка при первом запуске
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length)
           .setFontWeight('bold')
           .setBackground('#172127')
           .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    var now = new Date();
    sheet.appendRow([
      Utilities.formatDate(now, 'Europe/Moscow', 'dd.MM.yyyy'),
      Utilities.formatDate(now, 'Europe/Moscow', 'HH:mm:ss'),
      txt(data.name),
      txt(data.phone),      // ← был #ERROR!: номер начинается с «+»
      txt(data.price),
      txt(data.project),
      txt(data.src),
      txt(data.page),
      txt(data.utm_source),
      txt(data.utm_medium),
      txt(data.utm_campaign),
      txt((data.ua || '').slice(0, 300))
    ]);

    // уведомление в Telegram, если заполнен BOT_TOKEN / CHAT_ID
    notifyTelegram(data);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** GET для проверки: откройте URL в браузере — должен вернуться статус */
function doGet() {
  return json({ ok: true, service: 'anapa-dom-leads', sheet: SHEET_NAME });
}

/**
 * РАЗОВЫЙ РЕМОНТ уже сломанных ячеек (#ERROR! в столбце «Телефон»).
 *
 * Запустите один раз из редактора Apps Script: выберите функцию
 * fixBrokenCells в списке сверху → «Запустить». Разрешения подтвердите.
 *
 * Что делает: находит ячейки, где формула начинается с «=», за которой
 * сразу идёт + - или @ (то есть номер телефона, а не настоящая формула
 * вида =SUM(A1:A9)), и переписывает их обычным текстом.
 */
function fixBrokenCells() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return 'Лист «' + SHEET_NAME + '» не найден';

  var last = sheet.getLastRow();
  if (last < 2) return 'Данных нет — нечего чинить';

  var rows = last - 1;
  var cols = sheet.getLastColumn();
  var fixed = [];

  for (var c = 1; c <= cols; c++) {
    var rng = sheet.getRange(2, c, rows, 1);
    var formulas = rng.getFormulas();

    for (var r = 0; r < rows; r++) {
      var f = formulas[r][0];
      // «=+7 (916)…» / «=-…» / «=@…» — это телефон, а не формула
      if (f && /^=[+\-@]/.test(f)) {
        var col = String.fromCharCode(64 + c);   // A -> 1, B -> 2 …
        var cell = sheet.getRange(r + 2, c);
        cell.setValue(txt(f.replace(/^=+/, '')));
        fixed.push(col + (r + 2));
      }
    }
  }

  return 'Исправлено ячеек: ' + fixed.length +
         (fixed.length ? ' → ' + fixed.join(', ') : ' — все чисто');
}

/* ---------- утилиты ---------- */

/**
 * Google Sheets считает формулой любое значение, начинающееся с
 * = + - @ . Поэтому номер «+7 (916) 123-45-67» превращался в
 * «#ERROR! Синтаксическая ошибка в формуле».
 *
 * Решение — ведущая апострофная кавычка: она не выводится в ячейке,
 * а заставляет Таблицы хранить значение как обычный текст.
 *
 * Почему не «Формат → Обычный текст» на столбце: при форматировании
 * в «@» апостроф из txt() стал бы видимым символом. Одно из двух.
 */
function txt(v) {
  if (v === undefined || v === null) return '';
  var s = String(v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

var BOT_TOKEN = '';   // токен бота Telegram от @BotFather
var CHAT_ID   = '';   // id чата/канала, куда слать заявки

function notifyTelegram(data) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  var text = '🔥 Новая заявка с лендинга\n\n' +
            '👤 ' + (data.name  || '—') + '\n' +
            '📞 ' + (data.phone || '—') + '\n' +
            '💰 ' + (data.price || '—');
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: CHAT_ID, text: text })
    });
  } catch (err) {
    console.error('Telegram уведомление не ушло: ' + err);
  }
}
