/*******************************************************
 * AccelMail Apps Script Backend (Code.gs)
 * - Auto-creates sheets and default settings
 * - GET: /?route=config | /?route=pricing | /?route=ensureSheets
 * - POST: action=submitOrder | action=updateSettings | action=quoteRequest
 * - File uploads saved to Drive (Artwork, Logo, Mailing List CSV)
 * - Tuesday-only scheduling + blackout validation
 *******************************************************/

/** ====== SHEET NAMES & HEADERS ====== */
var SHEET_SUBMISSIONS = 'Submissions';
var SHEET_QUOTES      = 'Quotes';
var SHEET_DESIGNS     = 'DesignRequests';
var SHEET_LISTS       = 'MailingLists';
var SHEET_SETTINGS    = 'Settings';

var HEADERS_SUBMISSIONS = [
  'Timestamp','SubmissionID','Type','Status',
  'BusinessName','ContactName','Email','Phone',
  'Address','City','State','Zip',
  'MailerSize','QuantityRange','Budget',
  'PerPiece','TotalCost','MailOutDate',
  'DesignServiceRequested',
  'ArtworkFileId','ArtworkFileName','ArtworkUrl',
  'LogoFileId','LogoFileName','LogoUrl',
  'ListFileId','ListFileName','ListUrl',
  'Notes','InvoiceLink'
];

var HEADERS_QUOTES = [
  'Timestamp','SubmissionID','BusinessName','Email',
  'MailerSize','QuantityRange','Message','Files','Status'
];

var HEADERS_DESIGNS = [
  'Timestamp','SubmissionID','BusinessName','Email',
  'HeadlineOffer','DesignDescription','CTA','BrandColorHex',
  'IncludeLogo','UseBrandColors','DesignFee','AssignedTo','Status'
];

var HEADERS_LISTS = [
  'Timestamp','SubmissionID','BusinessName','Email',
  'ListFileId','ListFileName','ListUrl','RecordCount','Validated','Notes'
];

var HEADERS_SETTINGS = ['Field','Value','Description'];

/** ====== ENTRY POINTS ====== */
function doGet(e) {
  try {
    var route = (e && e.parameter && e.parameter.route) || '';
    if (route === 'ensureSheets') {
      ensureAllSheets_();
      return json_({ ok: true, message: 'Sheets ensured.' });
    }
    if (route === 'config') {
      ensureAllSheets_();
      return json_(getConfig_());
    }
    if (route === 'pricing') {
      ensureAllSheets_();
      return json_(getPricing_());
    }
    return json_({ ok: true, message: 'AccelMail API Ready' });
  } catch (err) {
    return json_({ ok: false, error: String(err) }, 500);
  }
}

function doPost(e) {
  try {
    ensureAllSheets_();
    var action = (e && e.parameter && e.parameter.action) || 'submitOrder';

    if (action === 'updateSettings') {
      return handleUpdateSettings_(e);
    }
    if (action === 'quoteRequest') {
      return handleQuoteRequest_(e);
    }
    return handleSubmitOrder_(e);
  } catch (err) {
    return json_({ ok: false, error: String(err) }, 500);
  }
}

/** ====== CORE HANDLERS ====== */
function handleSubmitOrder_(e) {
  var p = e.parameter || {};
  var files = (e && e.files) || {};
  var s = getSettings_();

  var business   = trim_(p.company || p.businessName);
  var contact    = trim_(p.name || p.contactName);
  var email      = trim_(p.email);
  var phone      = trim_(p.phone);
  var address    = trim_(p.address);
  var city       = trim_(p.city);
  var state      = trim_(p.state);
  var zip        = trim_(p.zip);
  var size       = trim_(p.mailerSize);
  var qtyRange   = trim_(p.quantityRange);
  var budget     = toNumber_(p.budget);
  var notes      = trim_(p.notes);
  var mailDate   = trim_(p.mailOutDate);

  var validDate  = validateMailDate_(mailDate, s);
  if (!validDate.ok) return json_({ ok: false, error: validDate.error }, 400);

  var estimate   = estimatePricing_(size, qtyRange, s);
  var perPiece   = estimate.perPiece || 0;
  var totalCost  = estimate.total || 0;
  var isQuote    = estimate.mode === 'quote' || isQuoteRange_(qtyRange, s.REQUEST_QUOTE_THRESHOLD);

  var store = ensureUploadsFolder_(s);
  var savedArtwork = saveFileIfPresent_(files, 'artwork', store.folder, 'Artwork');
  var savedLogo = saveFileIfPresent_(files, 'logo', store.folder, 'Logo');
  var savedList = saveFileIfPresent_(files, 'listCsv', store.folder, 'MailingList');

  var subId = 'AM-' + Utilities.getUuid().slice(0,8).toUpperCase();
  var now = new Date();
  var type = isQuote ? 'QUOTE' : 'PAY';
  var status = 'New';

  var invoiceLink = (!isQuote) ? getInvoiceLink_(size, qtyRange, s) : '';

  var row = [
    now, subId, type, status,
    business, contact, email, phone,
    address, city, state, zip,
    size, qtyRange, budget,
    perPiece, totalCost, mailDate,
    bool_(p.designServiceRequested),
    savedArtwork.id, savedArtwork.name, savedArtwork.url,
    savedLogo.id, savedLogo.name, savedLogo.url,
    savedList.id, savedList.name, savedList.url,
    notes, invoiceLink
  ];

  var sh = getSheet_(SHEET_SUBMISSIONS, HEADERS_SUBMISSIONS);
  sh.appendRow(row);

  if (isQuote) {
    var qSh = getSheet_(SHEET_QUOTES, HEADERS_QUOTES);
    var filesSummary = summarizeFiles_(savedArtwork, savedLogo, savedList);
    qSh.appendRow([now, subId, business, email, size, qtyRange, notes, filesSummary, 'Open']);
  }

  if (bool_(p.designServiceRequested)) {
    var dSh = getSheet_(SHEET_DESIGNS, HEADERS_DESIGNS);
    dSh.appendRow([
      now, subId, business, email,
      trim_(p.headline), trim_(p.designDesc), trim_(p.cta), trim_(p.brandColors),
      bool_(p.includeLogo), bool_(p.useBrandColors), s.DESIGN_FEE, '', 'Pending'
    ]);
  }

  if (savedList.id) {
    var lSh = getSheet_(SHEET_LISTS, HEADERS_LISTS);
    var recordCount = countCsvRecords_(savedList);
    lSh.appendRow([now, subId, business, email, savedList.id, savedList.name, savedList.url, recordCount, 'No', notes]);
  }

  maybeNotify_(s, { subId: subId, type: type, status: status, business: business, email: email, size: size, qtyRange: qtyRange, totalCost: totalCost, mailDate: mailDate, invoiceLink: invoiceLink });

  return json_({
    ok: true,
    submissionId: subId,
    mode: isQuote ? 'quote' : 'pay',
    invoiceLink: invoiceLink || '',
    estimate: { perPiece: perPiece, total: totalCost }
  });
}

function handleQuoteRequest_(e) {
  var p = e.parameter || {};
  var files = (e && e.files) || {};
  var s = getSettings_();

  var business = trim_(p.company || p.businessName);
  var email = trim_(p.email);
  var size = trim_(p.mailerSize);
  var qtyRange = trim_(p.quantityRange);
  var message = trim_(p.message || p.notes);

  var store = ensureUploadsFolder_(s);
  var savedArtwork = saveFileIfPresent_(files, 'artwork', store.folder, 'Artwork');
  var savedLogo = saveFileIfPresent_(files, 'logo', store.folder, 'Logo');
  var savedList = saveFileIfPresent_(files, 'listCsv', store.folder, 'MailingList');

  var subId = 'AM-' + Utilities.getUuid().slice(0,8).toUpperCase();
  var now = new Date();
  var qSh = getSheet_(SHEET_QUOTES, HEADERS_QUOTES);
  var filesSummary = summarizeFiles_(savedArtwork, savedLogo, savedList);
  qSh.appendRow([now, subId, business, email, size, qtyRange, message, filesSummary, 'Open']);

  maybeNotify_(s, { subId: subId, type: 'QUOTE', status: 'Open', business: business, email: email, size: size, qtyRange: qtyRange });

  return json_({ ok: true, submissionId: subId, mode: 'quote' });
}

function handleUpdateSettings_(e) {
  var p = e.parameter || {};
  var s = getSettings_();
  var adminKey = String(p.adminKey || '');
  if (adminKey !== s.ADMIN_KEY) return json_({ ok: false, error: 'Unauthorized' }, 401);

  var field = p.field;
  var value = p.value;
  var desc  = p.description || '';
  if (field && typeof value !== 'undefined') {
    upsertSetting_(field, value, desc);
  } else if (p.payload) {
    try {
      var obj = JSON.parse(p.payload);
      Object.keys(obj).forEach(k => upsertSetting_(k, obj[k], ''));
    } catch (err) {
      return json_({ ok: false, error: 'Invalid JSON payload' }, 400);
    }
  } else {
    return json_({ ok: false, error: 'No settings provided' }, 400);
  }

  return json_({ ok: true });
}

/** ====== CONFIG / PRICING ====== */
function getConfig_() {
  var s = getSettings_();
  return {
    mailerSizes: JSON.parse(s.MAILER_SIZES || '[]'),
    blackoutDates: JSON.parse(s.BLACKOUT_DATES || '[]'),
    designFee: Number(s.DESIGN_FEE) || 50
  };
}

function getPricing_() {
  var s = getSettings_();
  return {
    mailerSizes: JSON.parse(s.MAILER_SIZES || '[]')
  };
}

/** ====== UTILITIES ====== */
function ensureAllSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  getSheet_(SHEET_SUBMISSIONS, HEADERS_SUBMISSIONS, ss);
  getSheet_(SHEET_QUOTES, HEADERS_QUOTES, ss);
  getSheet_(SHEET_DESIGNS, HEADERS_DESIGNS, ss);
  getSheet_(SHEET_LISTS, HEADERS_LISTS, ss);
  getSheet_(SHEET_SETTINGS, HEADERS_SETTINGS, ss);
  var settingsSh = ss.getSheetByName(SHEET_SETTINGS);
  if (settingsSh.getLastRow() < 2) {
    upsertSetting_('MAILER_SIZES', JSON.stringify([{name: '4x8', pricing: [{range: '50-99', rate: 0.4, invoice: 'link'}]}]), 'Sizes with pricing');
    upsertSetting_('BLACKOUT_DATES', '[]', 'JSON array of YYYY-MM-DD');
    upsertSetting_('DESIGN_FEE', '50', 'Flat fee');
    upsertSetting_('ADMIN_KEY', 'secret', 'For updates');
  }
}

function getSheet_(name, headers, ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
  }
  return sh;
}

function getSettings_() {
  var sh = getSheet_(SHEET_SETTINGS, HEADERS_SETTINGS);
  var data = sh.getDataRange().getValues().slice(1);
  var settings = {};
  data.forEach(row => settings[row[0]] = row[1]);
  return settings;
}

function upsertSetting_(field, value, desc) {
  var sh = getSheet_(SHEET_SETTINGS, HEADERS_SETTINGS);
  var data = sh.getDataRange().getValues();
  var found = false;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === field) {
      sh.getRange(i+1, 2).setValue(value);
      sh.getRange(i+1, 3).setValue(desc);
      found = true;
      break;
    }
  }
  if (!found) {
    sh.appendRow([field, value, desc]);
  }
}

function ensureUploadsFolder_(s) {
  var drive = DriveApp;
  var root = drive.getRootFolder();
  var folderName = 'AccelMail Uploads';
  var folders = root.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : root.createFolder(folderName);
  return { folder: folder };
}

function saveFileIfPresent_(files, key, folder, prefix) {
  if (!files[key]) return { id: '', name: '', url: '' };
  var blob = files[key];
  var file = folder.createFile(blob);
  return {
    id: file.getId(),
    name: prefix + '_' + file.getName(),
    url: file.getUrl()
  };
}

function summarizeFiles_() {
  var args = Array.prototype.slice.call(arguments);
  return args.filter(f => f.id).map(f => f.name).join(', ');
}

function validateMailDate_(dateStr, s) {
  var date = new Date(dateStr);
  if (isNaN(date.getTime())) return { ok: false, error: 'Invalid date' };
  var day = date.toLocaleString('en-us', { weekday: 'long' });
  if (day !== 'Tuesday') return { ok: false, error: 'Mail dates must be Tuesdays' };
  var blackouts = JSON.parse(s.BLACKOUT_DATES || '[]');
  if (blackouts.includes(dateStr)) return { ok: false, error: 'Date is blacked out' };
  return { ok: true };
}

function isQuoteRange_(range, threshold) {
  return parseInt(range.split('-')[1] || range.split('+')[0]) >= threshold;
}

function estimatePricing_(size, range, s) {
  var sizes = JSON.parse(s.MAILER_SIZES || '[]');
  var matchSize = sizes.find(sz => sz.name === size);
  if (!matchSize) return { perPiece: 0, total: 0, mode: 'pay' };
  var matchTier = matchSize.pricing.find(t => t.range === range);
  if (!matchTier) return { perPiece: 0, total: 0, mode: 'quote' };
  var minQty = parseInt(range.split('-')[0]);
  var total = matchTier.rate * minQty;
  return { perPiece: matchTier.rate, total: total, mode: matchTier.mode || 'pay' };
}

function getInvoiceLink_(size, range, s) {
  var sizes = JSON.parse(s.MAILER_SIZES || '[]');
  var matchSize = sizes.find(sz => sz.name === size);
  var matchTier = matchSize.pricing.find(t => t.range === range);
  return matchTier.invoice || '';
}

function maybeNotify_(s, data) {
  if (s.NOTIFY_EMAIL) {
    MailApp.sendEmail(s.NOTIFY_EMAIL, 'New Submission: ' + data.subId, JSON.stringify(data, null, 2));
  }
}

function trim_(str) { return (str || '').trim(); }
function toNumber_(str) { return Number(str) || 0; }
function bool_(str) { return str === 'true' || str === 'on' || !!str; }
function countCsvRecords_(file) { return 0; } // Stub

function json_(obj, status = 200) {
  var res = ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  if (status !== 200) res.setStatus(status);
  return res;
}