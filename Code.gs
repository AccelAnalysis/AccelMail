function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName('CampaignRequests');
    if (!sheet) {
      sheet = doc.insertSheet('CampaignRequests');
    }

    var params = e.parameter; 
    
    if (e.postData && e.postData.contents && e.postData.type === 'application/json') {
       try {
         var jsonData = JSON.parse(e.postData.contents);
         for (var key in jsonData) {
           params[key] = jsonData[key];
         }
       } catch(err) {
       }
    }

    // Parse survey_data JSON string if present
    if (params.survey_data) {
      try {
        var surveyData = JSON.parse(params.survey_data);
        for (var key in surveyData) {
          // Store survey fields with a prefix to group them or avoid collisions
          // Convert arrays (checkboxes) to comma-separated strings
          var val = surveyData[key];
          if (Array.isArray(val)) {
            val = val.join(', ');
          }
          params[key] = val;
        }
      } catch (e) {
        console.error("Error parsing survey_data", e);
      }
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() > 0 ? sheet.getLastColumn() : 1).getValues()[0];
    if (headers[0] === "") headers = [];

    var newRow = [];
    var timestamp = new Date();

    if (headers.indexOf('Timestamp') === -1) {
      headers.push('Timestamp');
      sheet.getRange(1, headers.length).setValue('Timestamp');
    }

    for (var i = 0; i < headers.length; i++) {
      var header = headers[i];
      if (header === 'Timestamp') {
        newRow.push(timestamp);
      } else {
        newRow.push(params[header] || '');
      }
    }

    for (var key in params) {
      if (headers.indexOf(key) === -1 && key !== 'Timestamp') {
        headers.push(key);
        sheet.getRange(1, headers.length).setValue(key);
        newRow.push(params[key]);
      }
    }

    sheet.appendRow(newRow);

    return ContentService
      .createTextOutput(JSON.stringify({ 'result': 'success', 'row': sheet.getLastRow() }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ 'result': 'error', 'error': e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function setup() {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  if (!doc.getSheetByName('CampaignRequests')) {
    doc.insertSheet('CampaignRequests');
  }
}
