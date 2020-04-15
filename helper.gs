/*
 * @OnlyCurrentDoc
 */

// Helper functions for creating new rounds for supported 1822-style games

// Add a custom menu to the active spreadsheet, including a separator and a sub-menu.
function onOpen(e) {
  SpreadsheetApp.getUi()
  .createMenu('1822')
  .addItem('Create new round', 'openNewRoundDialog')
  .addToUi();
}

function openNewRoundDialog() {
  // Auto-detect game name
  let gameName = detectGameName();
  if (gameName == null) {
    // Game name not found in active sheet
    let ui = SpreadsheetApp.getUi();
    let errMsg = "Unable to determine name of game.";
    ui.alert("Error!", errMsg, ui.ButtonSet.OK);
  }
  else {
    // Save game name
    let scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty('gameName', gameName.toLowerCase());
    
    let html = HtmlService.createHtmlOutputFromFile('round')
    .setWidth(580)
    .setHeight(260)
    SpreadsheetApp.getUi()
    .showModalDialog(html, 'Create new ' + gameName + ' round');
  }
}

function Results() {
  this.gameName = "";
  this.newName = "";
  this.newType = "";
  this.currentName = "";
  this.currentType = "";
  this.data = [];
  this.changes = [];
  this.logged = [];
  this.summary = [];
  this.outlines = [];
  this.reminders = [];
  this.errors = [];
  this.lastRow = 0;
  this.lastCol = 0;
  
  this.log = function(val) { this.logged.push(val); }
  this.summarize = function(val) { this.summary.push(val); }
  this.outline = function(val) { this.outlines.push(val); }
  this.reminder = function(val) { this.reminders.push(val); }
  this.error = function(val) { this.errors.push(val); }
  
  // Change a data value
  this.change = function(i, j, val, delay) {
    // Default value
    if (delay == null) {
      delay = false;
    }
    
    if (this.data[i][j] !== val) {
      this.data[i][j] = val;
      // If a change has already been pushed for this row/column/delay combination, remove it
      this.changes = this.changes.filter(function(e) { return (e[0] !== i || e[1] !== j || e[3] !== delay); });
      this.changes.push([i, j, val, delay]);
    }
  }
  
  // Change a data value by adding to the existing value
  // Should only be used with data that immediately affects this round
  this.changeAdd = function(i, j, val) {
    this.change(i, j, this.data[i][j] + val, false);
  }
  
  // Check if a value is -1, and if so, log what was being searched
  // index: index from search function; -1 if not found
  // search: string description of what was being searched for
  // return: true if the value is a -1 (indicating an error), false otherwise
  this.checkIndex = function(index, search) {
    if (index < 0) {
      this.error("Unable to locate " + search);
      return true;
    }
    return false;
  }

  this.show = function() {
    var ui = SpreadsheetApp.getUi();
    if (this.errors.length > 0) {
      // Show errors
      ui.alert("Error", this.errors.join("\n"), ui.ButtonSet.OK);
    }
    else {
      // Save data as strings using user properties
      var userProperties = PropertiesService.getUserProperties();
      var queuedChanges = {"gameName": this.gameName, "newName": this.newName, "newType": this.newType, "currentName": this.currentName, "currentType": this.currentType, "log": this.logged, "changes": this.changes, "summary": this.summary, "outlines": this.outlines, "reminders": this.reminders, "lastRow": this.lastRow, "lastCol": this.lastCol};
      userProperties.setProperty("queuedChanges", JSON.stringify(queuedChanges));
      
      if (this.currentType == "SR") {
        // Open confirmation sidebar if this round is an SR
        var html = HtmlService
        .createHtmlOutputFromFile('confirm')
        .setTitle(this.gameName.toUpperCase() + ": Round summary");
        SpreadsheetApp.getUi().showSidebar(html);
      }
      else {
        // Otherwise, immediately create the new round
        confirmNewRound();
      }
    }
  }
}

function getQueuedChanges() {
  let userProperties = PropertiesService.getUserProperties();
  let queuedChanges = JSON.parse(userProperties.getProperty("queuedChanges"));
  return queuedChanges;
}

// Detect game name
// This value must be in the two columns and the first 40 rows
function detectGameName() {
  // Use active sheet
  let cells = SpreadsheetApp.getActiveSheet().getRange(1, 1, 40, 2).getValues();
  let games = supportedGames();
  let gameName = null;
  for (i=0; i<games.length; i++) {
    var roundInd = cells.indexOf2D(games[i].toUpperCase());
    if (roundInd[0] > -1 && roundInd[0] <= 39) {
      gameName = cells[roundInd[0]][roundInd[1]];
      break;
    }
  }
  return gameName;
}

// Detect whether a given sheet is a stock round or operating round
// This value must be in the first 10 columns and the first 40 rows
function detectRound(name) {
  let cells = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name).getRange(1, 1, 40, 10).getValues();
  let roundInd = cells.indexOf2D("Enter \nOR/SR");
  if (roundInd[0] == -1 || roundInd[0] >= 39) {
    return null;
  }
  let round = cells[roundInd[0] + 1][roundInd[1]];
  if (round == "OR" || round == "SR") {
    return round;
  }
  return null;
}

function getSheetNames() {
  let sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  let names = [];
  for (i=0; i<sheets.length; i++) {
    var name = sheets[i].getName();
    if (name.toLowerCase() != "setup") {
      names.push(name);
    }
  }
  return names;
}

function getGameName() {
  let scriptProperties = PropertiesService.getScriptProperties();
  return scriptProperties.getProperty('gameName');
}

function validateForm(formObject) {
  var errors = {"newName": true, "currentName": true};
  errors.newName = validateNewName(formObject.newName);
  errors.currentName = validateCurrentName(formObject.currentName);
  return errors;
}

function validateNewName(str) {
  if (str == "" || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(str)) {
    return false;
  }
  return true;
}

function validateCurrentName(str) {
  if (!str || !detectRound(str)) {
    return false;
  }
  return true;
}

// Find difference between two arrays
Array.prototype.diff = function(compArr) {
  return this.filter(function(val) { return compArr.indexOf(val) < 0; });
}

Array.prototype.includes = function(search) {
  return (this.indexOf(search) > -1);
}

String.prototype.isBlank = function() {
  return ["", "-", "na", "n/a"].includes(this.toLowerCase());
}

// Extract number from a private/minor.
// E.g., "18"->"18", "M3"->"3"
// arr: of valid values for privates/minors
String.prototype.extractNum = function(arr) {
  if (arr.includes(String(this))) {
    var up = String(this).toUpperCase();
    return up[0] == arr[0][0] ? parseInt(up.substring(1)) : parseInt(up);
  }
  return parseInt(this);
}

Array.prototype.trainArrayToString = function() {
  return this.join(',');
}

String.prototype.trainStringToArray = function() {
  return this.replace(/\s/g, '').split(',').filter(function(val) { return val !== ""; });
}

// Find row/column index of element OR a 1D sub-array in 2D array
// search: element/array to find
// vOrient: false for horizontal search array (default), true for vertical search array
// Any elements of search with "*" count as wildcards
Array.prototype.indexOf2D = function(search,vOrient){
  // Default value
  if (vOrient == null) {
    vOrient = false;
  }
  
  // If search is not an array, convert it to one
  if (!Array.isArray(search)) {
    search = [search];
  }
  else if (search.length == 0) {
    return [-1, -1];
  }
  
  // Search for specified subarray
  for (i=0; i<this.length - (1 - vOrient)*(search.length + 1); i++) {
    colLoop:
    for (j=0; j<this[i].length - vOrient*(search.length + 1); j++) {
      for (k=0; k<search.length; k++) {
        if (this[i + vOrient*k][j+(1 - vOrient)*k] != search[k] && search[k] != "*") {
          continue colLoop;
        }
      }
      return [i, j];
    }
  }
  
  return [-1, -1];
}
