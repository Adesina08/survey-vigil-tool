/*
 * OGSTEP Quality Control Apps Script
 * Generated to normalize survey data and provide JSON responses for dashboards.
 */

const CONFIG = {
  sheetId: '18iZezzcKT2JTvf7h9R_yU0LHEHNhPEIDVhJlcJs0yPc',
  sheetName: 'Sheet1',
  writeBack: {
    enable: false,
    statusHeader: 'QC Status',
    issuesHeader: 'QC Issues'
  },
  enumeratorField: 'A1. Enumerator ID',
  qcCooldownSeconds: 45
};

const HEADER_ALIASES = {
  'id': 'Submission ID',
  'uuid': 'uuid',
  'submissiontime': 'Submission Time',
  'a2date': 'Submission Date',
  'start': 'start',
  'end': 'end',
  'today': 'today',
  'username': 'username',
  'phonenumber': 'Respondent phone number',
  'a1enumeratorid': 'A1. Enumerator ID',
  'respondentname': 'Respondent name',
  'interviewernumber': 'Interviewer number',
  'respondentphonenumber': 'Respondent phone number',
  'deviceid': 'deviceid',
  'imei': 'imei',
  'subscriberid': 'subscriberid',
  'simserial': 'simserial',
  'state': 'State',
  'statename': 'State',
  'a3selectthelga': 'A3. select the LGA',
  'a3bselecttheward': 'A3b. Select the Ward',
  'a4communityvillage': 'A4. Community / Village',
  'a5gpscoordinates': 'A5. GPS Coordinates',
  'a5gpscoordinateslatitude': 'latitude',
  'a5gpscoordinateslongitude': 'longitude',
  'a5gpscoordinatesprecision': 'gps_precision',
  'a6consenttoparticipate': 'A6. Consent to participate',
  'a7sex': 'A7. Sex',
  'a8age': 'A8. Age'
};

const NUMERIC_FIELDS = [
  'A8. Age',
  'latitude',
  'longitude',
  'gps_precision',
  'C5. Monthly income (₦)',
  'E5.1. Monthly revenue',
  'E5.2. Monthly cost',
  'D3. Farm size (ha)',
  'D8. Total input cost last season',
  'D9. Total revenue last season'
];

const DATE_LIKE_FIELDS = [
  'Submission Time',
  'Submission Date',
  'start',
  'end',
  'today'
];

const QC_RULES = {
  GPS_OUT_OF_OGUN: {
    description: 'Latitude/Longitude outside Ogun State bounds',
    test: function(row) {
      const lat = toNumber_(row.latitude);
      const lon = toNumber_(row.longitude);
      if (lat == null || lon == null) {
        return false;
      }
      return lat < 6.2 || lat > 7.5 || lon < 2.3 || lon > 4.5;
    }
  },
  PHONE_TOO_SHORT: {
    description: 'Respondent phone number has fewer than 10 digits',
    test: function(row) {
      const phone = String(row['Respondent phone number'] || '').replace(/\D/g, '');
      if (!phone) {
        return false;
      }
      return phone.length < 10;
    }
  },
  END_BEFORE_START: {
    description: 'End time is before start time',
    test: function(row) {
      const start = parseDateForComparison_(row.start);
      const end = parseDateForComparison_(row.end);
      if (!start || !end) {
        return false;
      }
      return end.getTime() < start.getTime();
    }
  }
};

function normalizeHeaderKey_(header) {
  return String(header || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function serialToIso_(value) {
  if (value === '' || value == null) {
    return '';
  }
  var serial = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (isNaN(serial)) {
    return '';
  }
  var milliseconds = Math.round((serial - 25569) * 86400000);
  var date = new Date(milliseconds);
  if (isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString();
}

function toIsoString_(value) {
  if (value === '' || value == null) {
    return '';
  }
  var stringValue = String(value).trim();
  if (stringValue === '') {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(stringValue)) {
    return stringValue;
  }
  if (/^-?\d+(\.\d+)?$/.test(stringValue)) {
    var iso = serialToIso_(parseFloat(stringValue));
    if (iso) {
      return iso;
    }
  }
  var date = new Date(stringValue);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  return stringValue;
}

function toIsoDateOnly_(value) {
  var iso = toIsoString_(value);
  if (!iso) {
    return '';
  }
  return iso.substring(0, 10);
}

function toNumber_(value) {
  if (value === '' || value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  var cleaned = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/[^0-9\-\.]/g, '')
    .trim();
  if (cleaned === '') {
    return null;
  }
  var num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function normalizePhone_(value) {
  if (value === '' || value == null) {
    return '';
  }
  var digits = String(value).replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '0' + digits;
  }
  return digits;
}

function normalizeConsent_(value) {
  var text = String(value || '').trim().toLowerCase();
  if (!text) {
    return '';
  }
  if (['yes', 'approved', 'true', 'y'].indexOf(text) !== -1) {
    return 'Yes';
  }
  if (['no', 'denied', 'false', 'n'].indexOf(text) !== -1) {
    return 'No';
  }
  return value;
}

function normalizeSex_(value) {
  var text = String(value || '').trim().toLowerCase();
  if (!text) {
    return '';
  }
  if (text.charAt(0) === 'm') {
    return 'Male';
  }
  if (text.charAt(0) === 'f') {
    return 'Female';
  }
  return value;
}

function parseDateForComparison_(value) {
  if (!value) {
    return null;
  }
  var iso = toIsoString_(value);
  if (!iso) {
    return null;
  }
  var date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}

function readRowsRaw_() {
  var ss = SpreadsheetApp.openById(CONFIG.sheetId);
  var sheet = ss.getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + CONFIG.sheetName);
  }
  var values = sheet.getDataRange().getDisplayValues();
  if (!values.length) {
    return { sheet: sheet, headers: [], rows: [] };
  }
  var headers = values.shift();
  return {
    sheet: sheet,
    headers: headers,
    rows: values
  };
}

function buildHeaderMaps_(headers) {
  var aliasLookup = {};
  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    var normalizedKey = normalizeHeaderKey_(header);
    var canonical = HEADER_ALIASES[normalizedKey] || header;
    aliasLookup[i] = {
      canonical: canonical,
      alias: normalizedKey,
      original: header
    };
  }
  return aliasLookup;
}

function normalizeRow_(headerMap, row) {
  var normalized = {};
  for (var i = 0; i < row.length; i++) {
    var headerInfo = headerMap[i];
    if (!headerInfo) {
      continue;
    }
    var canonical = headerInfo.canonical;
    var value = row[i];
    if (value === undefined) {
      value = '';
    }
    normalized[canonical] = value;
  }

  if (!normalized.State) {
    normalized.State = 'Ogun State';
  }

  if (normalized['Respondent phone number']) {
    normalized['Respondent phone number'] = normalizePhone_(normalized['Respondent phone number']);
  } else {
    normalized['Respondent phone number'] = '';
  }

  normalized['A6. Consent to participate'] = normalizeConsent_(normalized['A6. Consent to participate']);
  normalized['A7. Sex'] = normalizeSex_(normalized['A7. Sex']);

  if (normalized['A5. GPS Coordinates']) {
    var gpsParts = String(normalized['A5. GPS Coordinates']).trim().split(/[ ,]+/);
    if (!normalized.latitude && gpsParts[0]) {
      var lat = toNumber_(gpsParts[0]);
      if (lat != null) {
        normalized.latitude = lat;
      }
    }
    if (!normalized.longitude && gpsParts[1]) {
      var lon = toNumber_(gpsParts[1]);
      if (lon != null) {
        normalized.longitude = lon;
      }
    }
    if (!normalized.gps_precision && gpsParts[3]) {
      var precision = toNumber_(gpsParts[3]);
      if (precision != null) {
        normalized.gps_precision = precision;
      }
    }
  }

  for (var j = 0; j < NUMERIC_FIELDS.length; j++) {
    var numericField = NUMERIC_FIELDS[j];
    if (Object.prototype.hasOwnProperty.call(normalized, numericField)) {
      normalized[numericField] = toNumber_(normalized[numericField]);
    }
  }

  if (normalized.latitude != null) {
    normalized.latitude = toNumber_(normalized.latitude);
  }
  if (normalized.longitude != null) {
    normalized.longitude = toNumber_(normalized.longitude);
  }
  if (normalized.gps_precision != null) {
    normalized.gps_precision = toNumber_(normalized.gps_precision);
  }

  for (var k = 0; k < DATE_LIKE_FIELDS.length; k++) {
    var dateField = DATE_LIKE_FIELDS[k];
    if (Object.prototype.hasOwnProperty.call(normalized, dateField)) {
      if (dateField === 'Submission Date') {
        normalized[dateField] = toIsoDateOnly_(normalized[dateField]);
      } else {
        normalized[dateField] = toIsoString_(normalized[dateField]);
      }
    }
  }

  var additionalKeys = Object.keys(normalized);
  for (var idx = 0; idx < additionalKeys.length; idx++) {
    var key = additionalKeys[idx];
    if (/year/i.test(key) && !/target/i.test(key) && normalized[key] !== '') {
      var maybeIso = toIsoString_(normalized[key]);
      if (maybeIso) {
        normalized[key] = maybeIso;
      }
    }
  }

  var start = parseDateForComparison_(normalized.start);
  var end = parseDateForComparison_(normalized.end);
  if (start && end) {
    var minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    if (!isNaN(minutes)) {
      normalized['Interview Duration (minutes)'] = minutes;
    }
  }
  if (!normalized['Interview Duration (minutes)']) {
    normalized['Interview Duration (minutes)'] = null;
  }

  if (!Object.prototype.hasOwnProperty.call(normalized, 'QC Status')) {
    normalized['QC Status'] = '';
  }
  if (!Object.prototype.hasOwnProperty.call(normalized, 'QC Issues')) {
    normalized['QC Issues'] = '';
  }

  return normalized;
}

function runQc_(rows) {
  var annotated = [];
  var summary = {
    total: rows.length,
    pass: 0,
    fail: 0,
    ruleCounts: {}
  };
  var enumeratorStats = {};
  for (var i = 0; i < rows.length; i++) {
    var row = JSON.parse(JSON.stringify(rows[i]));
    var issues = [];
    for (var ruleCode in QC_RULES) {
      if (!QC_RULES.hasOwnProperty(ruleCode)) {
        continue;
      }
      try {
        if (QC_RULES[ruleCode].test(row)) {
          issues.push(ruleCode);
          summary.ruleCounts[ruleCode] = (summary.ruleCounts[ruleCode] || 0) + 1;
        }
      } catch (err) {
        issues.push('RULE_ERROR_' + ruleCode);
        summary.ruleCounts['RULE_ERROR_' + ruleCode] = (summary.ruleCounts['RULE_ERROR_' + ruleCode] || 0) + 1;
      }
    }
    if (issues.length) {
      row['QC Status'] = 'fail';
      row['QC Issues'] = issues.join('; ');
      summary.fail++;
    } else {
      row['QC Status'] = 'pass';
      row['QC Issues'] = '';
      summary.pass++;
    }
    annotated.push(row);
    var enumeratorName = row[CONFIG.enumeratorField] || 'Unknown';
    if (!enumeratorStats[enumeratorName]) {
      enumeratorStats[enumeratorName] = { enumerator: enumeratorName, total: 0, pass: 0, fail: 0 };
    }
    enumeratorStats[enumeratorName].total++;
    if (row['QC Status'] === 'pass') {
      enumeratorStats[enumeratorName].pass++;
    } else {
      enumeratorStats[enumeratorName].fail++;
    }
  }
  var qcByEnumerator = Object.keys(enumeratorStats).map(function(key) {
    return enumeratorStats[key];
  });
  return {
    rows: annotated,
    summary: summary,
    qcByEnumerator: qcByEnumerator
  };
}

function computeEnumeratorSummaryWithoutQc_(rows) {
  var enumeratorStats = {};
  for (var i = 0; i < rows.length; i++) {
    var row = JSON.parse(JSON.stringify(rows[i]));
    row['QC Status'] = '';
    row['QC Issues'] = '';
    var enumeratorName = row[CONFIG.enumeratorField] || 'Unknown';
    if (!enumeratorStats[enumeratorName]) {
      enumeratorStats[enumeratorName] = { enumerator: enumeratorName, total: 0, pass: 0, fail: 0 };
    }
    enumeratorStats[enumeratorName].total++;
    enumeratorStats[enumeratorName].pass++;
  }
  return Object.keys(enumeratorStats).map(function(key) {
    return enumeratorStats[key];
  });
}

function writeBackQc_(sheet, headers, rows) {
  if (!rows.length) {
    return;
  }
  var statusHeader = CONFIG.writeBack.statusHeader;
  var issuesHeader = CONFIG.writeBack.issuesHeader;
  var statusIndex = headers.indexOf(statusHeader);
  var issuesIndex = headers.indexOf(issuesHeader);

  if (statusIndex === -1) {
    statusIndex = headers.length;
    headers.push(statusHeader);
    sheet.getRange(1, statusIndex + 1).setValue(statusHeader);
  }
  if (issuesIndex === -1) {
    issuesIndex = headers.length;
    headers.push(issuesHeader);
    sheet.getRange(1, issuesIndex + 1).setValue(issuesHeader);
  }

  var statusValues = [];
  var issuesValues = [];
  for (var i = 0; i < rows.length; i++) {
    statusValues.push([rows[i]['QC Status'] || '']);
    issuesValues.push([rows[i]['QC Issues'] || '']);
  }

  sheet.getRange(2, statusIndex + 1, statusValues.length, 1).setValues(statusValues);
  sheet.getRange(2, issuesIndex + 1, issuesValues.length, 1).setValues(issuesValues);
}

function executeQualityControl_(options) {
  var raw = readRowsRaw_();
  var headerMap = buildHeaderMaps_(raw.headers);
  var normalizedRows = raw.rows.map(function(row) {
    return normalizeRow_(headerMap, row);
  });

  var performQc = options.performQc;
  var qcResult;
  var rowsForOutput;
  var qcSummary;
  var qcByEnumerator;

  if (performQc) {
    qcResult = runQc_(normalizedRows);
    rowsForOutput = qcResult.rows;
    qcSummary = qcResult.summary;
    qcByEnumerator = qcResult.qcByEnumerator;
  } else {
    rowsForOutput = normalizedRows.map(function(row) {
      row['QC Status'] = '';
      row['QC Issues'] = '';
      return row;
    });
    qcSummary = {
      total: rowsForOutput.length,
      pass: rowsForOutput.length,
      fail: 0,
      ruleCounts: {}
    };
    qcByEnumerator = computeEnumeratorSummaryWithoutQc_(rowsForOutput);
  }

  var shouldWrite = performQc && (options.saveQc || CONFIG.writeBack.enable);
  if (shouldWrite && rowsForOutput.length) {
    var lock = LockService.getScriptLock();
    var locked = lock.tryLock(10000);
    if (!locked) {
      throw new Error('Unable to acquire lock for QC write-back.');
    }
    try {
      writeBackQc_(raw.sheet, raw.headers, rowsForOutput);
    } finally {
      lock.releaseLock();
    }
  }

  return {
    rows: rowsForOutput,
    qcSummary: qcSummary,
    qcByEnumerator: qcByEnumerator
  };
}

function buildResponseObject_(data) {
  return {
    rows: data.rows,
    qcSummary: data.qcSummary,
    qcByEnumerator: data.qcByEnumerator,
    stateTargets: [
      { State: 'Ogun State', 'State Target': 2000 }
    ],
    stateAgeTargets: [
      { State: 'Ogun State', 'Age Group': '15-24', 'Age Target': 500 }
    ],
    stateGenderTargets: [
      { State: 'Ogun State', Gender: 'Female', 'Gender Target': 1200 },
      { State: 'Ogun State', Gender: 'Male', 'Gender Target': 800 }
    ]
  };
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var qcParam = String(params.qc || '').toLowerCase();
    var saveParam = String(params.saveQc || '').toLowerCase();

    var performQc = qcParam === 'false' ? false : true;
    var saveQc = saveParam === 'true';

    var data = executeQualityControl_({
      performQc: performQc,
      saveQc: saveQc
    });

    var response = buildResponseObject_(data);
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    var errorPayload = {
      error: true,
      message: err && err.message ? err.message : String(err)
    };
    return ContentService.createTextOutput(JSON.stringify(errorPayload))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function runOGSTEPQualityControl_scheduled() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log('QC run skipped: lock not acquired.');
    return;
  }
  try {
    var cache = CacheService.getScriptCache();
    var lastRun = cache.get('qc:lastRun');
    var now = Date.now();
    if (lastRun && now - parseInt(lastRun, 10) < CONFIG.qcCooldownSeconds * 1000) {
      Logger.log('QC run skipped: cooldown active.');
      return;
    }
    executeQualityControl_({ performQc: true, saveQc: CONFIG.writeBack.enable });
    cache.put('qc:lastRun', String(now), 3600);
  } finally {
    lock.releaseLock();
  }
}

// To automate QC, set a time-driven trigger to run runOGSTEPQualityControl_scheduled
// every minute. The function uses a script lock and 45-second cooldown to avoid overlap.

