function buildSourceSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Source Data');
  var i, defaultDim, scopeRange, scopeRule, activeRange, activeRule;
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Source Data');
  }
  defaultDim = sheet.getRange(2, 2, 1, 3).getValues();
  sheet.getRange(1, 2, 1, 3).setValues([['Name', 'Scope', 'Active']]);
  sheet.getRange(2, 1, 1, 1).setValue('DEFAULT/EMPTY');
  sheet.getRange(1, 1, 203, 4).setNumberFormat('@');
  if (isEmpty(defaultDim[0])) {
    sheet.getRange(2, 2, 1, 3).setNumberFormat('@').setValues([['(n/a)', 'HIT', 'false']]);
  }
  for (i = 1; i <= 200; i++) {
    sheet.getRange(2 + i, 1, 1, 1).setValue('ga:dimension' + i);
  }
  
  // Set validation for SCOPE
  scopeRange = sheet.getRange(2, 3, 201, 1);
  scopeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['HIT','PRODUCT','SESSION','USER'])
    .setAllowInvalid(false)
    .setHelpText('Scope must be one of HIT, PRODUCT, SESSION or USER')
    .build();
  scopeRange.setDataValidation(scopeRule);
  
  // Set validation for ACTIVE
  activeRange = sheet.getRange(2, 4, 201, 1);
  activeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['true', 'false'])
    .setAllowInvalid(false)
    .setHelpText('Active must be one of true or false')
    .build();
  activeRange.setDataValidation(activeRule);
}

function fetchAccounts() {
  return Analytics.Management.AccountSummaries.list({
    fields: 'items(id,name,webProperties(id,name))'
  });
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
    .getContent();
}

function isEmpty(row) {
  return /^$/.test(row[0]) && /^$/.test(row[1]) && /^$/.test(row[2]);
}

function isValid(row) {
  var name = row[0];
  var scope = row[1];
  var active = row[2];
  return !/^$/.test(name) && /HIT|SESSION|USER|PRODUCT/.test(scope) && /true|false/.test(active);
}

function buildSourceData(sheet) {
  var range = sheet.getRange(3, 2, 200, 3).getValues();
  var defaultDim = sheet.getRange(2, 2, 1, 3).getValues();
  if (!isValid(defaultDim[0])) {
    throw new Error('Invalid source value found in DEFAULT/EMPTY row');
  }
  var sourceDimensions = [];
  var i;
  for (i = 0; i < range.length; i++) {
    if (!isEmpty(range[i]) && !isValid(range[i])) {
      throw new Error('Invalid source value found in dimension ga:dimension' + (i + 1));
    }
    if (!isEmpty(range[i])) {
      sourceDimensions.push({
        id: 'ga:dimension' + (i + 1),
        name: range[i][0],
        scope: range[i][1],
        active: range[i][2]
      });
    } else {
      sourceDimensions.push({
        name: defaultDim[0][0] || '(n/a)',
        scope: defaultDim[0][1] || 'HIT',
        active: defaultDim[0][2] || 'false'
      });
    }
  }
  return sourceDimensions;
}

function updateDimension(action, aid, pid, index, newDimension) {
  if (action === 'update') {
    return Analytics.Management.CustomDimensions.update(newDimension, aid, pid, 'ga:dimension' + index, {ignoreCustomDataSourceLinks: true});
  }
  if (action === 'create') {
    return Analytics.Management.CustomDimensions.insert(newDimension, aid, pid);
  }
}

function startProcess(aid, pid, limit) {
  var dimensions = Analytics.Management.CustomDimensions.list(aid, pid, {fields: 'items(id, name, scope, active)'});
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Source Data');
  var sourceData = buildSourceData(sheet);
  var template = HtmlService.createTemplateFromFile('ProcessDimensions');
  template.data = {
    limit: limit,
    dimensions: dimensions,
    sourceData: sourceData,
    accountId: aid,
    propertyId: pid
  };
  SpreadsheetApp.getUi().showModalDialog(template.evaluate().setWidth(400).setHeight(400), 'Manage Custom Dimensions for ' + pid);
} 

function isValidSheet(sheet) {
  var defaultDim = sheet.getRange(2, 2, 1, 3).getValues();
  var dims = sheet.getRange(3, 2, 200, 3).getValues();
  var i;
  if (!isValid(defaultDim[0])) {
    throw new Error('You must populate the DEFAULT/EMPTY row with proper values');
  }
  for (i = 0; i < dims.length; i++) {
    if (!isEmpty(dims[i]) && !isValid(dims[i])) {
      throw new Error('Invalid values for dimension ga:dimension' + (i + 1));
    }
  }
  return true;
}

function openDimensionModal() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Source Data');
  var html = HtmlService.createTemplateFromFile('PropertySelector').evaluate().setWidth(400).setHeight(280);
  if (!sheet) { 
    throw new Error('You need to create the Source Data sheet first');
  }
  if (!isValidSheet(sheet)) {
    throw new Error('You must populate the Source Data fields correctly');
  }
  SpreadsheetApp.getUi().showModalDialog(html, 'Select account and property for management');
}

function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Google Analytics Custom Dimension Manager')
      .addItem('1. Build/reformat Source Data sheet', 'buildSourceSheet')
      .addItem('2. Manage Custom Dimensions', 'openDimensionModal')
      .addToUi();
}
