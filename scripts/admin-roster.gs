/**
 * Bound to spreadsheet 1cbB5PELQVXnKsiKe5HCwg32kKBzgD5YpxwW1UNYLP5w.
 * Reads tab «Thông tin chung của Admin» on each request. Returns only match true/false.
 *
 * Deploy → New deployment → Web app.
 * Execute as: Me. Who has access: Anyone. Deploy, then authorize.
 * Put the web app URL in Vercel as ADMIN_ROSTER_SCRIPT_URL.
 */
var ROSTER_SPREADSHEET_ID = "1cbB5PELQVXnKsiKe5HCwg32kKBzgD5YpxwW1UNYLP5w";
var ROSTER_SHEET_NAME = "Thông tin chung của Admin";
var PHONE_HEADER = "Số Điện Thoại";
var PIN_HEADER = "Mã PIN đăng nhập AI Seeding";

function doGet() {
  return json_({ ready: true });
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var body = JSON.parse(raw);
    var phone = digits_(body && body.phone);
    var pin = body && body.pin != null ? String(body.pin).trim() : "";
    if (!phone || !pin || phone.length > 20 || pin.length > 64) {
      return json_({ match: false });
    }
    var sheet = rosterSheet_();
    if (!sheet) return json_({ error: "bad_sheet" });
    var values = sheet.getDataRange().getDisplayValues();
    if (!values || !values.length) return json_({ error: "bad_sheet" });
    var header = values[0].map(function (cell) {
      return String(cell == null ? "" : cell).trim();
    });
    var phoneCol = header.indexOf(PHONE_HEADER);
    var pinCol = header.indexOf(PIN_HEADER);
    if (phoneCol < 0 || pinCol < 0) return json_({ error: "bad_sheet" });
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var rowPhone = digits_(row[phoneCol]);
      var rowPin = row[pinCol] == null ? "" : String(row[pinCol]).trim();
      if (!rowPhone || !rowPin) continue;
      if (phonesEqual_(rowPhone, phone) && rowPin === pin) return json_({ match: true });
    }
    return json_({ match: false });
  } catch (err) {
    return json_({ error: "unavailable" });
  }
}

function rosterSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) spreadsheet = SpreadsheetApp.openById(ROSTER_SPREADSHEET_ID);
  return spreadsheet.getSheetByName(ROSTER_SHEET_NAME);
}

function digits_(value) {
  return String(value == null ? "" : value).replace(/\D/g, "");
}

function phonesEqual_(left, right) {
  if (left === right) return true;
  var a = left.charAt(0) === "0" ? left.slice(1) : left;
  var b = right.charAt(0) === "0" ? right.slice(1) : right;
  return a.length > 0 && a === b;
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
