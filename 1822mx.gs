/*
* @OnlyCurrentDoc
*/

// Compatible with 1822MX v0.1 playtest rules

// Add a custom menu to the active spreadsheet, including a separator and a sub-menu.
function onOpen(e) {
  SpreadsheetApp.getUi()
  .createMenu('1822MX')
  .addItem('Create new round', 'openNewRoundDialog')
  .addToUi();
}

function openNewRoundDialog() {
  var html = HtmlService.createHtmlOutputFromFile('round')
  .setWidth(580)
  .setHeight(260)
  SpreadsheetApp.getUi()
  .showModalDialog(html, '1822MX: Create new round');
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

function validateForm(formObject) {
  var errors = {"newName": true, "currentName": true};
  errors.newName = validateNewName(formObject.newName);
  errors.currentName = validateCurrentName(formObject.currentName);
  return errors;
}

function getSheetNames() {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  var names = [];
  for (i=0; i<sheets.length; i++) {
    var name = sheets[i].getName();
    if (name.toLowerCase() != "extra data") {
      names.push(name);
    }
  }
  return names;
}

// Detect whether a given sheet is a stock round or operating round
function detectRound(name) {
  var round = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name).getRange(18, 4).getValue();
  if (round == "OR" || round == "SR") {
    return round;
  }
  return null;
}

function Results() {
  this.newName = "";
  this.newType = "";
  this.currentName = "";
  this.currentType = "";
  this.data = [];
  this.changes = [];
  this.logged = [];
  this.reminders = [];
  this.errors = [];
  this.lastRow = 0;
  this.lastCol = 0;
  
  this.log = function(val) { this.logged.push(val); }
  this.reminder = function(val) { this.reminders.push(val); }
  this.error = function(val) { this.errors.push(val); }
  
  // Change a data value
  this.change = function(i, j, val, delay) {
    // Default value
    if (delay == null) {
      delay = false;
    }
    
    if (this.data[i][j] != val) {
      this.data[i][j] = val;
      // If a change has already been pushed for this row/column/delay combination, remove it
      this.changes = this.changes.filter(function(e) { return (e[0] != i || e[1] != j || e[3] != delay); });
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
      ui.alert(this.errors.join("\n"));
    }
    else {
      // Save data as strings using user properties
      var userProperties = PropertiesService.getUserProperties();
      userProperties.setProperty("newName", JSON.stringify(this.newName));
      userProperties.setProperty("newType", JSON.stringify(this.newType));
      userProperties.setProperty("currentName", JSON.stringify(this.currentName));
      userProperties.setProperty("currentType", JSON.stringify(this.currentType));
      userProperties.setProperty("log", JSON.stringify(this.logged));
      userProperties.setProperty("changes", JSON.stringify(this.changes));
      userProperties.setProperty("reminders", JSON.stringify(this.reminders));
      userProperties.setProperty("lastRow", JSON.stringify(this.lastRow));
      userProperties.setProperty("lastCol", JSON.stringify(this.lastCol));

      if (this.currentType == "SR") {
        // Open confirmation sidebar if this round is an SR
        var html = HtmlService
        .createHtmlOutputFromFile('confirm')
        .setTitle('1822MX: Round summary');
        SpreadsheetApp.getUi().showSidebar(html);
      }
      else {
        // Otherwise, immediately create the new round
        confirmNewRound();
      }
    }
  }
}

function getResults() {
  var userProperties = PropertiesService.getUserProperties();
  var newName = JSON.parse(userProperties.getProperty("newName"));
  var newType = JSON.parse(userProperties.getProperty("newType"));
  var currentName = JSON.parse(userProperties.getProperty("currentName"));
  var currentType = JSON.parse(userProperties.getProperty("currentType"));
  var log = JSON.parse(userProperties.getProperty("log"));
  var changes = JSON.parse(userProperties.getProperty("changes"));
  var reminders = JSON.parse(userProperties.getProperty("reminders"));
  var lastRow = JSON.parse(userProperties.getProperty("lastRow"));
  var lastCol = JSON.parse(userProperties.getProperty("lastCol"));
  var results = {"currentName": currentName, "currentType": currentType, "newName": newName, "newType": newType, "log": log, "changes": changes, "reminders": reminders, "lastRow": lastRow, "lastCol": lastCol};
  return results;
}

// Create new round from saved user property data
function confirmNewRound() {
  // Get results
  var results = getResults();
  
  // Override changed data in specified sheet
  var source = SpreadsheetApp.getActiveSpreadsheet();
  var curSheet = source.getSheetByName(results.currentName);
  var data = curSheet.getRange(1, 1, results.lastRow, results.lastCol).getValues();
  
  // setValues() overrides formulas, and setFormulas() overrides values
  // RangeList objects cannot be used to simultaneously set different values
  // Workaround: set all formulas as strings
  // Allows single Range.setValues() at end, rather than multiple calls to Range.setValue()
  var formulas  = curSheet.getRange(1, 1, results.lastRow, results.lastCol).getFormulas();
  data = data.map(function(row, i) {
    return row.map(function(val, j) {
      var formula = formulas[i][j];
      // Current version of spreadsheet has issue with #REF! errors in cells for winning bidders (among other places)
      return (formula ? formula.replace(/,#REF!/g, "") : val);
    });
  });
  
  var changeArr = results.changes;
  for (i=0; i<changeArr.length; i++) {
    if (!changeArr[i][3]) {
      data[changeArr[i][0]][changeArr[i][1]] = changeArr[i][2];
    }
  }
  
  // Set values
  curSheet.getRange(1, 1, results.lastRow, results.lastCol).setValues(data);
  SpreadsheetApp.flush();
  
  // Copy to new spreadsheet
  var newSheet = curSheet.copyTo(source);
  
  // Rename sheet and move
  newSheet.setName(results.newName);
  newSheet.activate();
  source.moveActiveSheet(0);
  
  // Add "delayed" changes
  for (i=0; i<changeArr.length; i++) {
    if (changeArr[i][3]) {
      data[changeArr[i][0]][changeArr[i][1]] = changeArr[i][2];
    }
  }
  
  // Update values
  newSheet.getRange(1, 1, results.lastRow, results.lastCol).setValues(data);
  SpreadsheetApp.flush();
  
  // Display reminders
  var ui = SpreadsheetApp.getUi();
  if (results.reminders.length > 0) {
    ui.alert("Don't forget!", results.reminders.join("\n"), ui.ButtonSet.OK);
  }
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

// Check spreadsheet for errors and locate certain rows/columns
function createNewRound(formObject) {
  var results = new Results();
  results.newName = formObject.newName;
  results.newType = formObject.newType;
  results.currentName = formObject.currentName;
  
  // Player count
  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = 5;
  
  // Major companies, in order
  const MAJORS = ["CHP", "FCM", "FCP", "FNM", "IRM", "MC", "MIR", "NdeM"]
  
  // Total number in game
  const NUM_MINORS = 24;
  const NUM_PRIVATES = 18;
  const NUM_MAJORS = MAJORS.length - 1; // exclude NdeM
  
  // Valid names of minors
  const MINORS = (function(){
    var names = [];
    for (i=1; i<NUM_MINORS+1; i++) {
      names.push("M" + i);
      names.push(i.toString());
    }
    return names;
  })();
  
  // Valid names of privates
  const PRIVATES = (function(){
    var names = [];
    for (i=1; i<NUM_PRIVATES+1; i++) {
      names.push("P" + i.toString());
      names.push(i.toString());
    }
    return names;
  })();
  
  // Available for bidding
  const MINORS_FOR_BIDDING = 4;
  const PRIVATES_FOR_BIDDING = 3;
  const CONCESSIONS_FOR_BIDDING = 3;
  
  // Stock market values
  const STOCK_PRICES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 135, 150, 165, 180, 200, 220, 245, 270, 300, 330, 360, 400, 450, 500, 550, 600];
  
  // Train types
  const NUM_TRAIN_TYPES = 7;
  
  // Map phase changes to type of train that rusts
  const RUST = {3: "L", 4: 2, 6: 3, 7: 4};
  
  // Valid names for trains (ordered)
  const TRAINS = ["E", "7", "6", "5", "4", "3", "2", "L"]
  const PERMANENTS = ["2P", "P2", "3/2", "3/2P", "P3/2", "LP", "PL", "P+", "+"]
  const ALL_TRAINS = TRAINS.concat(PERMANENTS);
  
  // Get active sheet
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(results.currentName);
  
  // Get last row/column
  results.lastRow = sheet.getLastRow();
  results.lastCol = sheet.getLastColumn();
  
  // Retrieve all data
  results.data = sheet.getRange(1, 1, results.lastRow, results.lastCol).getValues();
  
  // Get number of players in cell B1
  // Like the sheet, this check rounds floats to integers
  var numPlayers = Math.round(parseFloat(results.data[0][1]));
  if (isNaN(numPlayers) || numPlayers < MIN_PLAYERS || numPlayers > MAX_PLAYERS) {
    results.error("Number of valid players in cell B1 must be an integer between " + MIN_PLAYERS + " and " + MAX_PLAYERS + ".");
  }
  
  // Create map of player names to rows
  var playerIndices = results.data.indexOf2D(["PD", "Player"]);
  if (results.checkIndex(playerIndices[0], "list of players")) { return results.show(); }
  var playerRow = {};
  for (i=0; i<MAX_PLAYERS; i++) {
    var playerName = results.data[playerIndices[0] + 1 + i][playerIndices[1] + 1];
    if (playerName != "" && playerName != "-") {
      playerRow[playerName] = playerIndices[0] + 1 + i;
    }
  }
  
  // Create map of minors to column numbers
  var minorIndices = results.data.indexOf2D("Minor Companies (president gets 1 cert for a minor. Enter a 1 for the president)");
  if (results.checkIndex(minorIndices[0], "cells for minor ownership/shares")) { return results.show(); }
  var minorCol = {};
  for (i=0; i<NUM_MINORS; i++) {
    minorCol[(i+1).toString()] = minorIndices[1] + i;
    minorCol["M" + (i+1)] = minorIndices[1] + i;
  }
  
  // Get column with row headers for minors ("Director", "Treasury", "Privates owned", etc.)
  var minorHeaderMatch = ["Director", "*", "Treasury", "Market $", "*", "Trains", "Name", "Home", "*", "Privates owned"];
  var minorHeaderIndices = results.data.indexOf2D(minorHeaderMatch, true);
  if (results.checkIndex(minorHeaderIndices[0], "row headers for minors")) { return results.show(); }
  var directorRow = minorHeaderIndices[0];
  var treasuryRow = directorRow + 2;
  var marketRow = directorRow + 3;
  var trainsRow = directorRow + 5;
  
  // Get OR/SR
  var typeMatch = results.data.indexOf2D("Enter \nOR/SR");
  if (results.checkIndex(typeMatch[0], "round type designation")) { return results.show(); }
  var typeRow = typeMatch[0] + 1;
  var typeCol = typeMatch[1];
  results.currentType = results.data[typeRow][typeCol];
  
  // Get "Misc" revenue income row for minors
  var miscIndices = results.data.indexOf2D(["Misc", "Revenue"], true);
  if (results.checkIndex(miscIndices[0], "miscellaneous revenue row for minors")) { return results.show(); }
  var miscRow = miscIndices[0];
  
  // Get row/column of private companies box
  var privateBoxMatch = ["Private Companies", "No."];
  var privateIndices = results.data.indexOf2D(privateBoxMatch, true);
  if (results.checkIndex(privateIndices[0], "cells with private company information")) { return results.show(); }
  
  // Get row/column of major concessions box
  var concessionIndices = results.data.indexOf2D(["Concessions", "Income"], true);
  if (results.checkIndex(concessionIndices[0], "cells with concession ownership information")) { return results.show(); }
  
  // Get majors column
  var majorsIndices = results.data.indexOf2D(["Majors", MAJORS[0]], true);
  if (results.checkIndex(majorsIndices[0], "cells with major company share information")) { return results.show(); }
  var majorsCol = majorsIndices[1];
  var ndemCol = majorsCol + NUM_MAJORS;
  
  // Get column starting private bids
  var colPrivateBids = results.data[0].indexOf("Privates");
  if (results.checkIndex(colPrivateBids, "private bid box")) { return results.show(); }
  
  // Get column starting minor bids
  var colMinorBids = results.data[0].indexOf("Minors");
  if (results.checkIndex(colMinorBids, "minor bid box")) { return results.show(); }
  
  // Get column starting major concession bids
  var colConcessionBids = results.data[0].indexOf("Concessions");
  if (results.checkIndex(colConcessionBids, "major concession bid box")) { return results.show(); }
  
  // Get row/column of train offer box
  var trainOfferMatch = ["Type", "Cost", "Available", "Bought (OR) & Exported (SR)", "Remaining", "Train Limit\nMin / Maj"];
  var trainOfferIndices = results.data.indexOf2D(trainOfferMatch);
  if (results.checkIndex(trainOfferIndices[0], "train offer box")) { return results.show(); }
  var trainTypeCol = trainOfferIndices[1];
  var availableTrainsCol = trainTypeCol + 2;
  var usedTrainsCol = trainTypeCol + 3;
  var remainingTrainsCol = trainTypeCol + 4;
  var trainLimitCol = trainTypeCol + 5;
  var l2Row = trainOfferIndices[0] + 1;
  
  // Get row for high bidder
  var winnerMatch = ["Bid", "Boxes", "High Bidder", "High $"];
  var winnerRow = results.data.indexOf2D(winnerMatch, true)[0];
  if (results.checkIndex(winnerRow, "row for high bidder")) { return results.show(); }
  winnerRow += 2;
  var winningBidRow = winnerRow + 1;
  
  // Get row/column for minor draw pile box
  var minorDrawIndices = results.data.indexOf2D(["Order", "Minor"]);
  if (results.checkIndex(minorDrawIndices[0], "minor draw pile")) { return results.show(); }
  // Extract array of draw order
  var minorDrawRow = minorDrawIndices[0] + 1;
  var minorDrawCol = minorDrawIndices[1] + 1;
  var minorDraws = results.data.map(function(value) { return value[minorDrawCol]; }).splice(minorDrawRow, NUM_MINORS);
  
  // Get row/column for private draw pile box
  var privateDrawIndices = results.data.indexOf2D(["Order", "Private"]);
  if (results.checkIndex(privateDrawIndices[0], "private draw pile")) { return results.show(); }
  // Extract array of draw order
  var privateDrawRow = privateDrawIndices[0] + 1;
  var privateDrawCol = privateDrawIndices[1] + 1;
  var privateDraws = results.data.map(function(value) { return value[privateDrawCol]; }).splice(privateDrawRow, NUM_PRIVATES);
  
  // Get row/column for major concession draw pile box
  var concessionDrawIndices = results.data.indexOf2D(["Order", "Concession"]);
  if (results.checkIndex(concessionDrawIndices[0], "major concession draw pile")) { return results.show(); }
  // Extract array of draw order
  var concessionDrawRow = concessionDrawIndices[0] + 2;
  var concessionDrawCol = concessionDrawIndices[1] + 1;
  var concessionDraws = results.data.map(function(value) { return value[concessionDrawCol]; }).splice(concessionDrawRow, NUM_MAJORS);
  
  // Get row/column for end-of-round private ownership
  var privateOwnerIndices = results.data.indexOf2D("End of round");
  if (results.checkIndex(privateOwnerIndices[0], "private ownership cells")) { return results.show(); }
  var privateOwnerRow = privateOwnerIndices[0];
  var privateOwnerCol = privateOwnerIndices[1];
  
  // Get row/column for end-of-round concession ownership
  var concessionOwnerIndices = results.data.indexOf2D("End Ownr");
  if (results.checkIndex(concessionOwnerIndices[0], "concession ownership cells")) { return results.show(); }
  var concessionOwnerRow = concessionOwnerIndices[0];
  var concessionOwnerCol = concessionOwnerIndices[1];
  
  // Get row/column for bank pool trains
  var bankPoolIndices = results.data.indexOf2D(["Type", "Cost", "# Available", "# Bought", "# Remaining"]);
  if (results.checkIndex(bankPoolIndices[0], "bank pool train cells")) { return results.show(); }
  var bankPoolRow = bankPoolIndices[0];
  var bankPoolCol = bankPoolIndices[1];
  
  // Get current phase
  var firstCol = results.data.map(function(value) { return value[0]; });
  var phaseRow = firstCol.indexOf("Phase");
  if (results.checkIndex(phaseRow, "current phase")) { return results.show(); }
  phaseRow++;
  var phase = results.data[phaseRow][0];
  results.log("Currently in phase " + phase);
  
  // Get row/column for previous sheet
  var prevSheetIndices = results.data.indexOf2D("Previous Sheet");
  if (results.checkIndex(prevSheetIndices[0], "previous sheet name cell")) { return results.show(); }
  var prevSheetRow = prevSheetIndices[0];
  var prevSheetCol = prevSheetIndices[1] + 2;
  
  // Get row/column for income/spending cells
  var incomeIndices = results.data.indexOf2D(["Stock", "Pvts/Conc", "Divs", "Bids", "Loan +/-", "Misc"]);
  if (results.checkIndex(incomeIndices[0], "previous sheet name cell")) { return results.show(); }
  var incomeRow = incomeIndices[0] + 1;
  var incomeCol = incomeIndices[1];
  
  // Get row for operational data
  var operateIndices = results.data.indexOf2D(["Track", "Token", "Train Purchases"], true);
  if (results.checkIndex(operateIndices[0], "operational data cells")) { return results.show(); }
  var operateRow = operateIndices[0];
  
  // HOUSEKEEPING FOR END OF STOCK ROUND
  if (results.currentType == "SR") {
    // RESOLVE MINOR BIDS
    var newMinors = results.data[1].slice(colMinorBids, colMinorBids + MINORS_FOR_BIDDING);
    var ndemNumTrains = 0;
    var sold = [];
    var removedMinor;
    var lastMinor;
    var minorsLeft = false;
    for (i=0; i<MINORS_FOR_BIDDING; i++) {
      var minor = results.data[1][colMinorBids + i];
      var winner = results.data[winnerRow][colMinorBids + i];
      
      // Is this minor blank?
      if (minor.toString().isBlank()) {
        var ignore = "No minor in bid box " + (i+1);
        if (i < MINORS_FOR_BIDDING - 1) {
          ignore += ". Ignoring remaining bid boxes";
        }
        results.log(ignore);
        break;
      }
      
      // Is this minor is the list of valid minors?
      if (!MINORS.includes(minor.toString().toUpperCase())) {
        results.error("Minor \"" + minor + "\" in bid box " + (i+1) + " not recognized");
        continue;
      }
      lastMinor = minor;
      
      // Were there no bidders?
      if (winner == "-") {
        var noBidders = "No bidders on minor " + minor;
        ndemNumTrains++;
        if (i == 0) {
          noBidders += "; it is removed";
          removedMinor = minor;
          newMinors.splice(0, 1);
          var removeReminder = "Minor " + removedMinor + " was removed. ";
          if (phase < 7) {
            // While NdeM is open, it absorbs removed minor's location
            removeReminder += "Add an NdeM token to its home location on the board";
          }
          else {
            // NdeM closes in phase 7, but minor is still removed
            removeReminder += "Its home location is now available for other station markers";
          }
          results.reminder(removeReminder);
        }
        else {
          minorsLeft = true;
        }
        results.log(noBidders);
      }
      else {
        // Minor was sold
        sold.push(minor);
        newMinors.splice(newMinors.indexOf(minor), 1);
        var thisMinorCol = minorCol[minor.toString().toUpperCase()];
        
        // Add minor share count to owner's row
        results.change(playerRow[winner], thisMinorCol, 1);
        
        // Add player as director
        results.change(directorRow, minorCol[minor.toString().toUpperCase()], winner);
        
        // Set starting price/treasury
        var startPrice = 50;
        var startTreasury = 100;
        var winningBid = results.data[winningBidRow][colMinorBids + i];
        if (phase > 1) {
          startPrice = Math.min(100, Math.floor((winningBid / 2.0) / 10.0) * 10);
        }
        if (phase == 2) {
          startTreasury = 2 * startPrice;
        }
        else if (phase > 2) {
          startTreasury = winningBid;
        }
        results.change(marketRow, thisMinorCol, startPrice);
        results.change(miscRow, thisMinorCol, startTreasury);
        
        results.log(winner + " is director of minor " + minor + ". Won for $" + winningBid + ", valued at $" + startPrice + ", $" + startTreasury + " treasury");
      }
    }
    
    // Determine minors to place in new bid boxes
    var minorOrder = "All minors are sold";
    if (lastMinor) {
      while (newMinors.length < MINORS_FOR_BIDDING) {
        lastMinor = lastMinor.toString().toUpperCase();
        if (lastMinor[0] != "M") {
          lastMinor = "M" + lastMinor;
        }
        
        // Search for last minor in draw pile
        var minorDrawMatch = minorDraws.indexOf(lastMinor);
        if (results.checkIndex(minorDrawMatch, lastMinor + " in minor draw pile")) { return results.show(); }
        if (minorDrawMatch < NUM_MINORS - 1) {
          // If last bid minor is not on bottom of draw pile, add the next minor to ongoing list
          lastMinor = minorDraws[minorDrawMatch + 1];
          newMinors.push(lastMinor);
          minorsLeft = true;
        }
        else {
          // If last bid minor is on bottom of draw pile, pad list with blanks
          newMinors.push("-");
        }
      }
      if (minorsLeft) {
        minorOrder = "New minor bid box order: " + newMinors.filter( function(val) { return !val.toString().isBlank(); }).join(", ");
      }
      for (i=0; i<newMinors.length; i++) {
        results.change(1, colMinorBids + i, newMinors[i], true);
      }
    }
    results.log(minorOrder);
    
    // NdeM train acquisition
    var trainType = phase == 1 ? "L" : "2";
    var remainingL2 = results.data[l2Row][remainingTrainsCol];
    if (phase > 2 && phase < 7) {
      results.log("NdeM acquires no L/2 trains in phase " + phase);
    }
    else if (remainingL2 < 1) {
      results.log("No L/2 trains to export to NdeM");
    }
    else {
      // NdeM acquires L/2 trains
      ndemNumTrains = Math.min(ndemNumTrains, remainingL2);
      
      // Add trains to NdeM's train row
      for (i=0; i<ndemNumTrains; i++) {
        if (results.data[trainsRow][ndemCol].toString().replace(/\s/g, '') == "") {
          results.change(trainsRow, ndemCol, trainType);
        }
        else {
          results.changeAdd(trainsRow, ndemCol, "," + trainType);
        }
      }
      var plural = ndemNumTrains == 1 ? "" : "s";
      results.log("NdeM acquires " + ndemNumTrains + " " + trainType + " train" + plural + " (of " + remainingL2 + " remaining)");
      
      // Update "Bought + Exported" trains
      results.changeAdd(l2Row, usedTrainsCol, ndemNumTrains);
    }
    
    // Did NdeM remove a minor in bid box 1?
    if (removedMinor && phase < 7) {
      // NdeM takes next available train
      for (i=0; i<NUM_TRAIN_TYPES; i++) {
        // Skip index 1 (merged cell for L/2 trains)
        if (i == 1) {
          continue;
        }
        
        var thisTrainsRemaining = results.data[l2Row + i][remainingTrainsCol];
        var thisTrainsBought = results.data[l2Row + i][usedTrainsCol];
        if (thisTrainsRemaining == "unlimited" || thisTrainsRemaining > 0) {
          // Add acquired train to NdeM
          results.changeAdd(l2Row + i, usedTrainsCol, 1);
          thisTrainsBought++;
          var acquiredType = i < 2 ? trainType : results.data[l2Row + i][trainTypeCol];
          results.changeAdd(trainsRow, ndemCol, "," + acquiredType);
          results.log("NdeM acquires " + acquiredType + " train through removal of minor " + removedMinor);
          
          // Did this trigger a phase change?
          // I.e., available and bought trains are equal
          var thisTrainsAvailable = results.data[l2Row + i][availableTrainsCol];
          if (thisTrainsAvailable == thisTrainsBought) {
            phase++;
            results.change(phaseRow, 0, phase);
            results.log("Phase " + phase + " begins");
            results.reminder("NdeM's acquisition of a " + acquiredType + " train by removing " + removedMinor + " triggered phase " + phase);
            if (RUST.hasOwnProperty(phase)) {
              results.reminder(RUST[phase] + " trains rust");
            }
            if (phase == 7) {
              results.reminder("NdeM is now closed (phase 7). NdeM operates once more, then is privatized.");
            }
          }
          break;
        }
      }
      
      // Minor becomes share in NdeM bank pool
      results.changeAdd(treasuryRow, ndemCol, 1);
      results.log("Add minor " + removedMinor + " as share in NdeM treasury");
    }
    
    // Return: array of invalid trains
    function getInvalidTrains(trainsArr) {
      // Find difference between this company's trains and valid trains
      return trainsArr.diff(ALL_TRAINS);
    }
    
    // Return: new trains string and message about rusted trains
    function rustTrains(oldTrains, coName) {
      var trains = {trains: "", msg: ""};
      // Strip whitespace from trains cell
      var newTrains = oldTrains;
      var rustedTrains = [];
      for (var p in RUST) {
        if (p <= phase) {
          newTrains = newTrains.filter(function(val) { return val != RUST[p]; });
          rustedTrains = rustedTrains.concat(oldTrains.filter(function(val) { return val == RUST[p]; }));
        }
      }
      
      var numRustedTrains = rustedTrains.length;
      if (numRustedTrains > 0) {
        var plural = "s";
        if (numRustedTrains == 1) { plural = ""; }
        trains.msg = coName + " loses " + numRustedTrains + " train" + plural + " (" + rustedTrains.join(', ') + ") to rusting";
      }
      trains.trains = newTrains.join(',');
      return trains;
    }
    
    // Get train limits
    var trainLimits = results.data[l2Row + phase - 1][trainLimitCol].split("/")
    var minorLimit = trainLimits[0];
    var majorLimit = trainLimits[1];
    if (majorLimit == "-") { majorLimit = 1e9; }
    
    // Create array of all company columns and names
    var cos = [];
    for (i=0; i<NUM_MINORS; i++) {
      cos.push({col: minorCol[i+1], name: "M" + (i+1), limit: minorLimit});
    }
    for (i=0; i<NUM_MAJORS+1; i++) {
      cos.push({col: majorsCol + i, name: results.data[1][majorsCol + i], limit: majorLimit});
    }
    
    // Every company: rust trains and discard to train limit
    var trainErrors = [];
    for (i=0; i<cos.length; i++) {
      var thisTrains = results.data[trainsRow][cos[i].col];
      // Convert into array without blank elements
      thisTrains = thisTrains.trainStringToArray();
      var invalidTrains = getInvalidTrains(thisTrains);
      if (invalidTrains.length > 0) {
        trainErrors.push(invalidTrains.join(", ") + " (" + cos[i].name + ")")
      }
      
      // Rust trains
      var thisTrains = rustTrains(thisTrains, cos[i].name);
      if (thisTrains.msg !== "") {
        results.log(thisTrains.msg);
      }
      results.change(trainsRow, cos[i].col, thisTrains.trains);
      
      // Discard trains to phase limit
      // Only discard non-permanent trains
      var trainArr = thisTrains.trains.trainStringToArray();
      var canDiscard = trainArr.diff(PERMANENTS);
      var thisPerms = trainArr.diff(TRAINS);
      // Sort trains: L's first, E's last
      canDiscard.sort(function(a,b){
        if (a == "L") { return -1; }
        else if (b == "L") { return 1; }
        else if (a == "E") { return 1; }
        else if (b == "E") { return -1; }
        else if (a < b) { return -1; }
        else if (b > a) { return 1; }
        return 0;
      });
      
      var prevLength = canDiscard.length;
      var removed = canDiscard.splice(0, prevLength - cos[i].limit);
      var discarded = prevLength - canDiscard.length;
      if (discarded > 0) {
        results.change(trainsRow, cos[i].col, canDiscard.concat(thisPerms).join(","));
        
        var discardLoc = "";
        // NdeM does not discard to bank pool
        if (cos[i].name.toUpperCase() !== "NDEM") {
          var discardLoc = "to bank pool ";
          // Add discarded trains to bank pool
          for (j=0; j<removed.length; j++) {
            // Do not add 7 trains to bank pool; there is no spot for them
            // L trains are not added to bank pool
            if (removed[j] != "7" && removed[j] != "L") {
              var discardRow = bankPoolRow + parseInt(removed[j]) - 1;
              var curPoolTrains = results.data[discardRow][bankPoolCol];
              if (curPoolTrains.replace(/\s/g, '') == "") {
                results.change(discardRow, bankPoolCol + 2, 1);
              }
              else {
                results.change(discardRow, bankPoolCol + 2, parseInt(results.data[discardRow][bankPoolCol + 2]) + 1);
              }
            }
          }
        }
        var plural = discarded == 1 ? "" : "s";
        results.log(cos[i].name + " discards " + discarded + " train" + plural + " (" + removed.join(', ') + ") " + discardLoc + "to meet limit of " + cos[i].limit);
      }
    }
    
    // Rust trains in bank pool
    for (var p in RUST) {
      // L trains never reach bank pool
      if (p <= phase && RUST[p] !== "L") {
        // If a train type has resulted, remove them from bought/available bank pool columns
        results.change(bankPoolRow + RUST[p] - 1, bankPoolCol + 2, 0);
        results.change(bankPoolRow + RUST[p] - 1, bankPoolCol + 3, 0);
      }
    }
    
    // Check if invalid trains were found
    if (trainErrors.length > 0) {
      var errorMsg = "Error rusting trains. Invalid trains: " + trainErrors.join("; ");
      results.error(errorMsg);
      return results.show();
    }
    
    // RESOLVE PRIVATE BIDS
    var newPrivates = results.data[1].slice(colPrivateBids, colPrivateBids + PRIVATES_FOR_BIDDING);
    var soldPrivates = [];
    var lastPrivate;
    var privatesLeft = false;
    for (i=0; i<PRIVATES_FOR_BIDDING; i++) {
      var private = results.data[1][colPrivateBids + i];
      var winner = results.data[winnerRow][colPrivateBids + i];
      
      // Is this item blank?
      if (private.toString().isBlank()) {
        var ignore = "No private in bid box " + (i+1);
        if (i < PRIVATES_FOR_BIDDING - 1) {
          ignore += ". Ignoring remaining bid boxes";
        }
        results.log(ignore);
        newPrivates.splice(i, PRIVATES_FOR_BIDDING - i);
        break;
      }
      
      // Is this item is the list of valid items?
      if (!PRIVATES.includes(private.toString().toUpperCase())) {
        results.error("Private \"" + private + "\" in bid box " + (i+1) + " not recognized");
        return results.show();
      }
      lastPrivate = private;
      
      // Were there no bidders?
      if (winner == "-") {
        results.log("No bidders on private " + private);
        privatesLeft = true;
      }
      else {
        // Private was sold
        newPrivates.splice(newPrivates.indexOf(private), 1);
        var winningBid = results.data[winningBidRow][colPrivateBids + i];
        
        // Add winner as owner for end of this round
        var privateNum = private.toString().extractNum(PRIVATES);
        results.change(privateOwnerRow + privateNum, privateOwnerCol, winner);
        
        results.log(winner + " won private " + private + " for $" + winningBid);
      }
    }
    
    // Determine privates to place in new bid boxes
    var privateOrder = "All privates are sold";
    if (lastPrivate) {
      while (newPrivates.length < PRIVATES_FOR_BIDDING) {
        lastPrivate = lastPrivate.toString().toUpperCase();
        if (lastPrivate[0] != "P") {
          lastPrivate = "P" + lastPrivate;
        }
        
        // Search for last private in draw pile
        var privateDrawMatch = privateDraws.indexOf(lastPrivate);
        if (results.checkIndex(privateDrawMatch, lastPrivate + " in private draw pile")) { return results.show(); }
        if (privateDrawMatch < NUM_PRIVATES - 1) {
          // If last bid private is not on bottom of draw pile, add the next private to ongoing list
          lastPrivate = privateDraws[privateDrawMatch + 1];
          newPrivates.push(lastPrivate);
          privatesLeft = true;
        }
        else {
          // If last bid private is on bottom of draw pile, pad list with blanks
          newPrivates.push("-");
        }
      }
      if (privatesLeft) {
        privateOrder = "New private bid box order: " + newPrivates.filter( function(val) { return !val.toString().isBlank(); }).join(", ");
      }
      for (i=0; i<newPrivates.length; i++) {
        results.change(1, colPrivateBids + i, newPrivates[i], true);
      }
    }
    results.log(privateOrder);
    
    // RESOLVE MAJOR CONCESSION BIDS
    var newConcessions = results.data[1].slice(colConcessionBids, colConcessionBids + CONCESSIONS_FOR_BIDDING);
    var soldConcessions = [];
    var lastConcession;
    var concessionsLeft = false;
    for (i=0; i<CONCESSIONS_FOR_BIDDING; i++) {
      var concessionFull = results.data[1][colConcessionBids + i];
      var winner = results.data[winnerRow][colConcessionBids + i];
      
      // Is this FCM?
      var concession = concessionFull.toString().toUpperCase();
      if (concession.indexOf("FCM") > -1) {
        concession = "FCM";
      }
      
      // Is this item blank?
      if (concession.isBlank()) {
        var ignore = "No concession in bid box " + (i+1);
        if (i < CONCESSIONS_FOR_BIDDING - 1) {
          ignore += ". Ignoring remaining bid boxes";
        }
        results.log(ignore);
        newConcessions.splice(i, CONCESSIONS_FOR_BIDDING - i);
        break;
      }
      
      // Is this item is the list of valid items?
      if (!MAJORS.includes(concession.toUpperCase())) {
        results.error("Major concession \"" + concession + "\" in bid box " + (i+1) + " not recognized");
        return results.show();
      }
      lastConcession = concession;
      
      // Were there no bidders?
      if (winner == "-") {
        results.log("No bidders on " + concession + " concession");
        concessionsLeft = true;
      }
      else {
        // Concession was sold
        newConcessions.splice(newConcessions.indexOf(concessionFull), 1);
        var winningBid = results.data[winningBidRow][colConcessionBids + i];
        
        // Add winner as owner for end of this round
        var majorNum = MAJORS.indexOf(concession) + 1;
        results.change(concessionOwnerRow + majorNum, concessionOwnerCol, winner);
        
        results.log(winner + " won " + concession + " concession for $" + winningBid);
        
        // If this is FCM, also add the winner as director of M18
        if (concession == "FCM") {
          sold.push("M18");
          // Add minor share count to owner's row
          results.change(playerRow[winner], minorCol["M18"], 1);
          
          // Add player as director
          results.change(directorRow, minorCol["M18"], winner);
          
          // Starting price is always $50, starting treasury is always $100
          results.change(marketRow, minorCol["M18"], 50);
          results.change(miscRow, minorCol["M18"], 100);
          
          results.log(winner + " is director of M18 as part of winning FCM concession. M18 valued at $50 with $100 in treasury");
        }
      }
    }
    if (sold.length > 0) {
      results.reminder("Update stock market for newly launched minors: " + sold.join(", "));
    }
    
    // Determine concessions to place in new bid boxes
    var concessionOrder = "All concessions have sold";
    if (lastConcession) {
      while (newConcessions.length < CONCESSIONS_FOR_BIDDING) {
        lastConcession = lastConcession.toString().toUpperCase();
        
        // Search for last concession in draw pile
        var concessionDrawMatch = concessionDraws.indexOf(lastConcession);
        if (results.checkIndex(concessionDrawMatch, lastConcession + " in concession draw pile")) { return results.show(); }
        if (concessionDrawMatch < NUM_MAJORS - 1) {
          // If last bid private is not on bottom of draw pile, add the next private to ongoing list
          lastConcession = concessionDraws[concessionDrawMatch + 1];
          newConcessions.push(lastConcession);
          concessionsLeft = true;
        }
        else {
          // If last bid private is on bottom of draw pile, pad list with blanks
          newConcessions.push("");
        }
      }
      if (concessionsLeft) {
        concessionOrder = "New concession bid box order: " + newConcessions.filter( function(val) { return !val.isBlank(); }).join(", ");
      }
      for (i=0; i<newConcessions.length; i++) {
        results.change(1, colConcessionBids + i, newConcessions[i], true);
      }
      
    }
    results.log(concessionOrder);
    
    // CHECK FOR SOLD-OUT MAJORS
    var soldoutMajors = [];
    for (i=0; i<NUM_MAJORS; i++) {
      // Are all shares of this major sold?
      if (results.data[treasuryRow][majorsCol + i] < 1) {
        // Increment market value
        var curPrice = results.data[marketRow][majorsCol + i];
        if (STOCK_PRICES.includes(curPrice)) {
          var thisMajor = results.data[1][majorsCol + i];
          soldoutMajors.push(thisMajor);
          var stockMatch = STOCK_PRICES.indexOf(curPrice);
          if (stockMatch == -1) {
            results.error("Stock price of $" + curPrice + " for major " + thisMajor + " not valid");
            return results.show();
          }
          var newPrice = STOCK_PRICES[Math.min(STOCK_PRICES.length - 1, stockMatch + 1)];
          results.change(marketRow, majorsCol + i, newPrice);
          var shareIncrease = "All shares of " + thisMajor + " are sold."
          if (curPrice == newPrice) {
            shareIncrease += " Stock prices is already at maximum of $" + curPrice
          }
          else {
            shareIncrease += " Stock price increases from $" + curPrice + " to $" + newPrice
          }
          results.log(shareIncrease);
        }
        else {
          results.error("Stock price $" + curPrice + " for major " + thisMajor + " is not valid");
          return results.show();
        }
      }
    }
    if (soldoutMajors.length > 0) {
      results.reminder("Increase the stock value for soldout majors: " + soldoutMajors.join(","));
    }
    
    // DETERMINE NEW PLAYER ORDER; take P7 and previous player order into account
    var numPlayers = parseInt(results.data[0][1]);
    var ownerP7 = results.data[privateOwnerRow + 7][privateOwnerCol];
    var players = [];
    for (i=0; i<numPlayers; i++) {
      var playerName = results.data[2+i][1];
      // In case of tie, retain player order from previous SR
      // To account for this, add a small amount <1 based on previous order
      var thisCash = (playerName == ownerP7 ? 2 : 1) * results.data[2+i][4] + 0.1*(numPlayers - results.data[2+i][0]);
      players.push({name: playerName, cash: thisCash});
    }
    players.sort(function(a,b) {
      return ((a.cash > b.cash) ? -1 : ((a.cash < b.cash) ? 1 : 0));
    });
    for (i=0; i<numPlayers; i++) {
      var thisOrder = players.map(function(a) { return a.name; }).indexOf(results.data[2+i][1]) + 1;
      results.change(2 + i, 0, thisOrder, true);
    }
    
    results.log("New player order: " + players.map(function(a) { return a.name; }).join(', '));
  }
  
  // HOUSEKEEPING FOR OPERATING ROUNDS
  else if (results.currentType == "OR" && phase > 1) {
    results.reminder("Resolve minor acquisitions in new sheet (if applicable)");
  }
  
  // HOUSEKEEPING FOR ALL ROUNDS
  // Changes are made only on newly created sheet
  
  // Enter name of previous sheet
  results.change(prevSheetRow, prevSheetCol, results.currentName, true);
  
  // Set SR/OR
  results.change(typeRow, typeCol, results.newType, true);
  
  for (i=0; i<9; i++) {
    // Clear out minor operational data
    for (j=1; j<NUM_MINORS + 1; j++) {
      results.change(operateRow + i, minorCol[j.toString()], "", true);
    }
    
    // Clear out major operational data
    for (j=0; j<NUM_MAJORS + 1; j++) {
      results.change(operateRow + i, majorsCol + j, "", true);
    }
  }
  
  // Clear out optional LP, 2P, and 3/2 income for majors
  for (j=0; j<NUM_MAJORS + 1; j++) {
    results.change(operateRow + 10, majorsCol + j, "", true);
  }
  
  for (i=0; i<MAX_PLAYERS; i++) {
    // Clear out SR bids
    for (j=0; j<MINORS_FOR_BIDDING + PRIVATES_FOR_BIDDING + CONCESSIONS_FOR_BIDDING + 2; j++) {
      results.change(incomeRow + i, colPrivateBids + j, "", true);
    }
    
    // Clear out stock purchases
    results.change(incomeRow + i, incomeCol, "", true);
    
    // Clear out loans/misc
    results.change(incomeRow + i, incomeCol + 4, "", true);
    results.change(incomeRow + i, incomeCol + 5, "", true);
  }
  
  // Prompt user with results
  return results.show();
}
