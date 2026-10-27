// Khotol — ХасБанкны гүйлгээний имэйлийг khotol.com/api/bank-sms руу дамжуулна.
//
// Банкны мэдэгдэл ирдэг Gmail данс дээр Google Apps Script болгон суулгана
// (суулгах заавар: README.md). 5 минут тутам шинэ имэйлийг шалгаж, текстийг нь
// SMS аппын адил төхөөрөмжийн токеноор илгээнэ. Задлах, давхардал шалгах, тоот
// таних бүгд сервер дээр — энд зөвхөн дамжуулна.
//
// Тохиргоо (Project Settings ▸ Script Properties) — кодонд нууц бичихгүй:
//   KHOTOL_TOKEN  khsms_…  (Админ ▸ Банкны SMS гүйлгээ ▸ төхөөрөмж бүртгэхэд гарсан токен)
//   BANK_FROM     (заавал биш) банкны илгээгч — анхдагч нь XacInfo@xacbank.mn
//
// Давтан илгээхэд аюулгүй: messageId = Gmail-ийн message id, сервер давхардлыг хаяна.

var SERVER = 'https://www.khotol.com';
var OVERLAP_SEC = 15 * 60; // сүүлд амжилттай илгээснээс 15 мин өмнөхөөс дахин шалгана
var FIRST_RUN_DAYS = 2;
var DEFAULT_FROM = 'XacInfo@xacbank.mn'; // ХасБанкны гүйлгээний мэдэгдэл (2026-10-27)

function relayBankEmails() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('KHOTOL_TOKEN');
  var from = props.getProperty('BANK_FROM') || DEFAULT_FROM;
  if (!token) throw new Error('KHOTOL_TOKEN тохируулаагүй');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var now = Math.floor(Date.now() / 1000);
    var cursor = Number(props.getProperty('CURSOR') || (now - FIRST_RUN_DAYS * 86400));
    var after = cursor - OVERLAP_SEC;

    var messages = [];
    var threads = GmailApp.search('from:' + from + ' after:' + after, 0, 100);
    threads.forEach(function (t) {
      t.getMessages().forEach(function (m) {
        var ts = Math.floor(m.getDate().getTime() / 1000);
        if (ts >= after && m.getFrom().toLowerCase().indexOf(from.toLowerCase()) !== -1) messages.push({ m: m, ts: ts });
      });
    });
    messages.sort(function (a, b) { return a.ts - b.ts; });

    for (var i = 0; i < messages.length; i++) {
      // Зөвхөн орлого — зарлагын (карт, POS) мэдээлэл Хотол руу дамжихгүй
      var r = /орлогын\s+гүйлгээ/i.test(messages[i].m.getPlainBody()) ? send(token, from, messages[i].m) : 'skip';
      if (r === 'retry' || r === 'stop') break; // дараагийн удаа энэ имэйлээс үргэлжилнэ
      cursor = Math.max(cursor, messages[i].ts);
    }
    props.setProperty('CURSOR', String(cursor));
  } finally {
    lock.releaseLock();
  }
}

/** 'ok' | 'skip' (сервер татгалзсан, дахин илгээхгүй) | 'retry' | 'stop' (токен буруу) */
function send(token, from, m) {
  var res = UrlFetchApp.fetch(SERVER + '/api/bank-sms', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      schemaVersion: 1,
      messageId: 'gmail:' + m.getId(),
      sender: from,
      body: (m.getSubject() + '\n' + m.getPlainBody()).slice(0, 2000),
      receivedAt: m.getDate().toISOString(),
    }),
    muteHttpExceptions: true,
    followRedirects: false,
  });
  var code = res.getResponseCode();
  if (code >= 200 && code < 300) return 'ok';
  if (code === 401 || code === 403) return 'stop';
  if (code === 429 || code >= 500) return 'retry';
  return 'skip';
}

/** Холболт шалгах — Run дарж Execution log-оос харна. */
function testConnection() {
  var token = PropertiesService.getScriptProperties().getProperty('KHOTOL_TOKEN');
  var res = UrlFetchApp.fetch(SERVER + '/api/bank-sms', {
    headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true, followRedirects: false,
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}

/** Нэг удаа ажиллуулна: 5 минут тутмын автомат ажиллагааг үүсгэнэ. */
function install() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'relayBankEmails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('relayBankEmails').timeBased().everyMinutes(5).create();
  relayBankEmails();
}
