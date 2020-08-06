/*
* @OnlyCurrentDoc
*/

// Automatic round generator for 1822-style games

// Compatible with:
// 1822CA v1.0 rules
// 1822MX v0.1 playtest rules
// https://github.com/etowle/1822

// Wrapper around createNewRound() for error-catching
function createNewRoundWrapper(formObject) {
  try {
    return createNewRound(formObject);
  }
  catch(err) {
    let ui = SpreadsheetApp.getUi();
    let errMsg = "Encountered the following error during script execution:\n\n";
    errMsg += err["stack"];
    errMsg += "\n\nPlease open an issue at https://github.com/etowle/1822. Please describe the issue and provide a link to a copy of the sheet that caused the error.";
    ui.alert("Error!", errMsg, ui.ButtonSet.OK);
  }
}

// Create new OR/SR
function createNewRound(formObject) {
  var results = new Results();
  let ui = SpreadsheetApp.getUi();
  results.gameName = formObject.gameName;
  results.newName = formObject.newName;
  results.newType = formObject.newType;
  results.currentName = formObject.currentName;
  results.protect = formObject.protect;
  
  // Number of header rows at top of sheet
  var headerRows = 3;
  
  // Get game-specific data
  var game = getSetup(results.gameName);
  if (!game) {
    results.error("Error retrieving details for selected game.");
    return results.show();
  }
  
  // Valid names of minors
  const MINORS = (function(){
    let names = [];
    for (var i=1; i<game.numMinors+1; i++) {
      names.push("M" + i);
      if (i < 10) {
        names.push("M0" + i);
      }
      names.push(i.toString());
    }
    return names;
  })();
  
  // Valid names of privates
  const PRIVATES = (function(){
    let names = [];
    for (var i=1; i<game.numPrivates+1; i++) {
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
  const YELLOW_ZONE_END = 45;
  
  // Train types
  const NUM_TRAIN_TYPES = 7;
  
  // Map phase changes to type of train that rusts
  const RUST = {3: "L", 4: 2, 6: 3, 7: 4};
  
  // Valid names for trains (ordered)
  const TRAINS = ["E", "7", "6", "5", "4", "3", "2", "L"]
  const ALL_TRAINS = TRAINS.concat(game.permanents);
  
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
  if (isNaN(numPlayers) || numPlayers < game.minPlayers || numPlayers > game.maxPlayers) {
    results.error(`Number of valid players in cell B1 must be an integer between ${game.minPlayers} and ${game.maxPlayers}.`);
  }
  
  // Create map of player names to rows
  var playerIndices = results.data.indexOf2D(["PD", "Player"]);
  if (results.checkIndex(playerIndices[0], "list of players")) { return results.show(); }
  var playerRow = {};
  for (var i=0; i<game.maxPlayers; i++) {
    var playerName = results.data[playerIndices[0] + headerRows - 1 + i][playerIndices[1] + 1];
    if (playerName != "" && playerName != "-") {
      playerRow[playerName] = playerIndices[0] + headerRows - 1 + i;
    }
  }
  
  // Create map of minors to column numbers
  var minorIndices = results.data.indexOf2D(game.minorHeaderText);
  if (results.checkIndex(minorIndices[0], "cells for minor ownership/shares")) { return results.show(); }
  var minorStartCol = minorIndices[1];
  var minorCol = {};
  for (var i=0; i<game.numMinors; i++) {
    minorCol[(i+1).toString()] = minorStartCol + i;
    minorCol["M" + (i+1)] = minorStartCol + i;
    if (i < 10) {
      minorCol["M0" + (i+1)] = minorStartCol + i;
    }
  }
  
  // Get column with row headers for minors ("Merger Comments", "Director", "Treasury", "Privates owned", etc.)
  var minorHeaderMatch = ["Merger\nComments", "*", "Director", "*", "Treasury", "Market $", "*", "Trains", "Name", "Home", "*", "Privates owned"];
  var minorHeaderIndices = results.data.indexOf2D(minorHeaderMatch, true);
  if (results.checkIndex(minorHeaderIndices[0], "row headers for minors")) { return results.show(); }
  var mergerCommentsRow = minorHeaderIndices[0];
  var directorRow = minorHeaderIndices[0] + 2
  var coBankPoolRow = mergerCommentsRow + 3;
  var treasuryRow = mergerCommentsRow + 4;
  var marketRow = mergerCommentsRow + 5;
  var yellowZoneRow = mergerCommentsRow + 6;
  var trainsRow = mergerCommentsRow + 7;
  
  // Get OR/SR
  var typeMatch = results.data.indexOf2D("Enter\nOR/SR");
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
  var majorsIndices = results.data.indexOf2D(["Majors", game.majors[0]], true);
  if (results.checkIndex(majorsIndices[0], "cells with major company share information")) { return results.show(); }
  var majorsCol = majorsIndices[1];
  var ndemCol = majorsCol + game.numMajors;
  
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
  var minorDrawIndices = results.data.indexOf2D(["Order", "", "Minor"]);
  if (results.checkIndex(minorDrawIndices[0], "minor draw pile")) { return results.show(); }
  // Extract array of draw order
  var minorDrawRow = minorDrawIndices[0] + 1;
  var minorDrawCol = minorDrawIndices[1] + 2;
  var minorDraws = results.data.map(value => value[minorDrawCol]).splice(minorDrawRow, game.numMinors);
  
  // Get row/column for private draw pile box
  var privateDrawIndices = results.data.indexOf2D(["Order", "", "Private"]);
  if (results.checkIndex(privateDrawIndices[0], "private draw pile")) { return results.show(); }
  // Extract array of draw order
  var privateDrawRow = privateDrawIndices[0] + 1;
  var privateDrawCol = privateDrawIndices[1] + 2;
  var privateDraws = results.data.map(value => value[privateDrawCol]).splice(privateDrawRow, game.numPrivates);
  
  // Get row/column for major concession draw pile box
  var concessionDrawIndices = results.data.indexOf2D(["Order", "", "Concession"]);
  if (results.checkIndex(concessionDrawIndices[0], "major concession draw pile")) { return results.show(); }
  // Extract array of draw order
  var concessionDrawRow = concessionDrawIndices[0] + 1;
  var concessionDrawCol = concessionDrawIndices[1] + 2;
  // Convert all concession draws to uppercase
  var concessionDraws = results.data.map(value => value[concessionDrawCol]).splice(concessionDrawRow, game.numMajors).map(m => m.toUpperCase());
  
  // Get row/column for end-of-round private ownership
  var privateOwnerIndices = results.data.indexOf2D("End of round");
  if (results.checkIndex(privateOwnerIndices[0], "private ownership cells")) { return results.show(); }
  var privateOwnerRow = privateOwnerIndices[0];
  var privateOwnerCol = privateOwnerIndices[1];
  
  // Get row/column for end-of-round concession ownership
  var concessionOwnerIndices = results.data.indexOf2D("End Owner");
  if (results.checkIndex(concessionOwnerIndices[0], "concession ownership cells")) { return results.show(); }
  var concessionOwnerRow = concessionOwnerIndices[0];
  var concessionOwnerCol = concessionOwnerIndices[1];
  
  // Get row/column for bank pool trains
  var bankPoolIndices = results.data.indexOf2D(["Type", "Cost", "# Available", "# Bought", "# Remaining"]);
  if (results.checkIndex(bankPoolIndices[0], "bank pool train cells")) { return results.show(); }
  var bankPoolRow = bankPoolIndices[0];
  var bankPoolCol = bankPoolIndices[1];
  
  // Get current phase
  var firstCol = results.data.map(value => value[0]);
  var phaseRow = firstCol.indexOf("Phase");
  if (results.checkIndex(phaseRow, "current phase")) { return results.show(); }
  phaseRow++;
  var phase = results.data[phaseRow][0];
  var startPhase = phase;
  results.log("Currently in phase " + phase);
  
  // Get row/column for previous sheet
  var prevSheetIndices = results.data.indexOf2D("Previous Sheet");
  if (results.checkIndex(prevSheetIndices[0], "previous sheet name cell")) { return results.show(); }
  var prevSheetRow = prevSheetIndices[0];
  var prevSheetCol = prevSheetIndices[1] + 2;
  
  // Get row/column for income/spending cells
  var incomeIndices = results.data.indexOf2D(game.incomeHeaders);
  if (results.checkIndex(incomeIndices[0], "income header cells")) { return results.show(); }
  var incomeRow = incomeIndices[0] + headerRows - 1;
  var incomeCol = incomeIndices[1];
  
  // Get row for operational data
  var operateIndices = results.data.indexOf2D(["Track", "Token", "Train Purchases", "Train Sales", "Mergers", "Share Sales", "Mail Income", "Misc"], true);
  if (results.checkIndex(operateIndices[0], "operational data cells")) { return results.show(); }
  var operateRow = operateIndices[0];
  var miscRow = operateRow + 7;
  
  // 1822CA-specific
  if (game.name == "1822ca") {
    // Get column for P8/P9 (1822CA)
    var incomePrivateIndices = results.data.indexOf2D(["P8", "P9"]);
    if (results.checkIndex(incomePrivateIndices[0], "cells for P8 and P9 income")) { return results.show(); }
    var p8Col = incomePrivateIndices[1];
    var p9Col = p8Col + 1;
    
    // Get tax haven row
    var taxIndices = results.data.indexOf2D("P11 tax haven");
    if (results.checkIndex(taxIndices[0], "row for tax haven private P11")) { return results.show(); }
    var taxRow = taxIndices[0];
  }
  
  // Types of "discardable" (normal) trains
  var discardable = ["L", "2", "3", "4", "5", "6", "7", "E"];
  
  // Whether or not NdeM was privatized at the end of a stock round
  var ndemPrivatized = false;
  
  // HOUSEKEEPING FOR END OF STOCK ROUND
  if (results.currentType == "SR") {
    // RESOLVE MINOR BIDS
    var newMinors = results.data[1].slice(colMinorBids, colMinorBids + MINORS_FOR_BIDDING);
    var numExportedTrains = 0;
    var sold = [];
    var removedMinor;
    var lastMinor;
    var minorsLeft = false;
    for (var i=0; i<MINORS_FOR_BIDDING; i++) {
      let minor = results.data[1][colMinorBids + i];
      let winner = results.data[winnerRow][colMinorBids + i];
      
      // Is this minor blank?
      if (minor.toString().isBlank()) {
        let ignore = `No minor in bid box ${i+1}`;
        if (i < MINORS_FOR_BIDDING - 1) {
          ignore += ". Ignoring remaining bid boxes";
        }
        results.log(ignore);
        break;
      }
      
      // Is this minor is the list of valid minors?
      if (!MINORS.includes(minor.toString().toUpperCase())) {
        results.error(`Minor "${minor}" in bid box ${i+1} not recognized`);
        continue;
      }
      lastMinor = minor;
      
      // Were there no bidders?
      if (winner == "-") {
        let noBidders = `No bidders on minor ${minor}`;
        numExportedTrains++;
        if (i == 0) {
          noBidders += "; it is removed";
          removedMinor = minor;
          newMinors.splice(0, 1);
          let removeSummary = `Minor ${removedMinor} was removed.`;
          if (phase < 7 && game.name == "1822mx") {
            // While NdeM is open, it absorbs removed minor's location
            removeSummary += " NdeM token placed on its home location on the board";
            let removeReminder = `Add an NdeM token to minor ${removedMinor}'s home location`;
            results.reminder(removeReminder);
          }
          else {
            removeSummary += " Its home location is now available for other station markers";
          }
          results.summarize(removeSummary);
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
        let thisMinorCol = minorCol[minor.toString().toUpperCase()];
        
        // Add minor share count to owner's row
        results.change(playerRow[winner], thisMinorCol, game.minorDirectorShares);
        
        // No need to set player as director; this is done via formula
        
        // Set starting price/treasury
        let startPrice = 50;
        let startTreasury = 100;
        let winningBid = results.data[winningBidRow][colMinorBids + i];
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
        
        results.log(`${winner} is director of minor ${minor}. Won for $${winningBid}, valued at $${startPrice}, $${startTreasury} treasury`);
      }
    }
    
    // Determine minors to place in new bid boxes
    var minorOrder = "All minors are sold";
    if (lastMinor) {
      while (newMinors.length < MINORS_FOR_BIDDING) {
        lastMinor = lastMinor.toString().toUpperCase();
        if (lastMinor[0] != "M") {
          lastMinor = `M${lastMinor}`;
        }
        
        // Search for last minor in draw pile
        let minorDrawMatch = minorDraws.indexOf(lastMinor);
        if (results.checkIndex(minorDrawMatch, lastMinor + " in minor draw pile")) { return results.show(); }
        if (minorDrawMatch < game.numMinors - 1) {
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
      for (var i=0; i<newMinors.length; i++) {
        results.change(1, colMinorBids + i, newMinors[i], true);
      }
    }
    results.log(minorOrder);
    
    // Export trains
    // 1822MX: NdeM train acquisition
    let trainType = phase == 1 ? "L" : "2";
    let remainingL2 = results.data[l2Row][remainingTrainsCol];
    if (phase > 2 && phase < 7) {
      results.log(`No L/2 trains exported in phase ${phase}`);
    }
    else if (remainingL2 < 1) {
      results.log("No L/2 trains to export");
    }
    else {
      // Export L/2 trains
      numExportedTrains = Math.min(numExportedTrains, remainingL2);
      
      if (game.name == "1822mx") {
        // Add trains to NdeM's train row
        for (var i=0; i<numExportedTrains; i++) {
          if (results.data[trainsRow][ndemCol].toString().replace(/\s/g, '') == "") {
            results.change(trainsRow, ndemCol, trainType);
          }
          else {
            results.changeAdd(trainsRow, ndemCol, "," + trainType);
          }
        }
      }
      let plural = numExportedTrains == 1 ? "" : "s";
      let exportMsg = `Exported ${numExportedTrains} ${trainType}-train${plural} (of ${remainingL2} remaining)`
      exportMsg += game.name == "1822mx" ? " to NdeM" : "";
      results.log(exportMsg);
      results.summarize(exportMsg);
      
      // Update "Bought + Exported" trains
      results.changeAdd(l2Row, usedTrainsCol, numExportedTrains);
    }
    
    // Was a minor removed from bid box 1?
    if (removedMinor && phase < 7) {
      // Export an additional train
      let extraExportMsg = "";
      let ndemClosedMsg = ""
      for (var i=0; i<NUM_TRAIN_TYPES; i++) {
        // Skip index 1 (merged cell for L/2 trains)
        if (i == 1) {
          continue;
        }
        
        let thisTrainsAvailable = results.data[l2Row + i][availableTrainsCol];
        let thisTrainsBought = results.data[l2Row + i][usedTrainsCol];
        if (thisTrainsAvailable == "unlimited" || thisTrainsAvailable > thisTrainsBought) {
          thisTrainsBought++;
          var acquiredType = i < 2 ? trainType : results.data[l2Row + i][trainTypeCol];
          // The next train listed may be "7 or E" rather than "7"
          if (acquiredType.toString().indexOf("7") > -1) {
            acquiredType = "7";
          }
          results.changeAdd(l2Row + i, usedTrainsCol, 1);
          if (game.name == "1822mx") {
            // Add acquired train to NdeM
            results.changeAdd(trainsRow, ndemCol, "," + acquiredType);
            extraExportMsg = `NdeM acquires ${acquiredType}-train through removal of minor ${removedMinor}`;
          }
          else {
            extraExportMsg = `Additional ${acquiredType}-train exported through removal of minor ${removedMinor}`;
          }
          results.log(extraExportMsg);
          
          // Did this trigger a phase change?
          // I.e., this was the first train bought of this type
          if (thisTrainsBought == 1) {
            // Don't necessarily increment by one. User may not be properly updating the phase
            phase = parseInt(acquiredType) || phase + 1
            results.change(phaseRow, 0, phase);
            let phaseChange = `Phase ${phase} begins`;
            extraExportMsg = `Export of a ${acquiredType}-train by removal of ${removedMinor} triggered phase ${phase}`;
            if (RUST.hasOwnProperty(phase)) {
              extraExportMsg += `. ${RUST[phase]}-trains rust`;
            }
            if (phase == 7 && game.name == "1822mx") {
              ndemClosedMsg = "NdeM is now closed (phase 7). NdeM operates once more, then is privatized.";
              ndemPrivatized = true;
              phaseChange += "; NdeM privatizes after one more operation";
            }
            results.log(phaseChange);
          }
          break;
        }
      }
      
      if (extraExportMsg) {
        results.summarize(extraExportMsg);
      }
      if (ndemClosedMsg) {
        results.summarize(ndemClosedMsg);
      }
      
      if (game.name == "1822mx") {
        // Minor becomes share in NdeM bank pool
        results.changeAdd(treasuryRow, ndemCol, 1);
        results.log(`Added minor ${removedMinor} as share in NdeM treasury`);
      }
    }
    
    // Return: array of invalid trains
    function getInvalidTrains(trainsArr) {
      // Find difference between this company's trains and valid trains
      return trainsArr.diff(ALL_TRAINS);
    }
    
    // Return: new trains string and message about rusted trains
    function rustTrains(oldTrains, coName) {
      let trains = {trains: "", msg: ""};
      // Strip whitespace from trains cell
      let newTrains = oldTrains;
      let rustedTrains = [];
      for (var p in RUST) {
        if (p <= phase) {
          newTrains = newTrains.filter(function(val) { return val != RUST[p]; });
          rustedTrains = rustedTrains.concat(oldTrains.filter(function(val) { return val == RUST[p]; }));
        }
      }
      
      let numRustedTrains = rustedTrains.length;
      if (numRustedTrains > 0) {
        let plural = numRustedTrains == 1 ? "" : "s";
        trains.msg = `${coName} loses ${numRustedTrains} train${plural} (` + rustedTrains.join(', ') + ") to rusting";
      }
      trains.trains = newTrains.join(',');
      return trains;
    }
    
    // Get train limits
    let trainLimits = results.data[l2Row + phase - 1][trainLimitCol].split("/")
    let minorLimit = trainLimits[0];
    let majorLimit = trainLimits[1];
    if (majorLimit == "-") { majorLimit = 1e9; }
    
    // Create array of all company columns and names
    let cos = [];
    for (var i=0; i<game.numMinors; i++) {
      cos.push({col: minorCol[i+1], name: `M${i+1}`, limit: minorLimit});
    }
    // Do not use game.numMajors; NdeM not included for 1822MX
    for (var i=0; i<game.majors.length; i++) {
      cos.push({col: majorsCol + i, name: results.data[1][majorsCol + i], limit: majorLimit});
    }
    
    // Every company: rust trains and discard to train limit
    let trainErrors = [];
    for (var i=0; i<cos.length; i++) {
      let thisTrains = results.data[trainsRow][cos[i].col];
      // Convert into array without blank elements
      thisTrains = thisTrains.trainStringToArray();
      let invalidTrains = getInvalidTrains(thisTrains);
      if (invalidTrains.length > 0) {
        trainErrors.push(invalidTrains.join(", ") + ` (${cos[i].name})`)
      }
      
      // Rust trains
      thisTrains = rustTrains(thisTrains, cos[i].name);
      if (thisTrains.msg !== "") {
        results.log(thisTrains.msg);
      }
      results.change(trainsRow, cos[i].col, thisTrains.trains);
      
      // Discard trains to phase limit
      // Only discard non-permanent trains
      let trainArr = thisTrains.trains.trainStringToArray();
      let canDiscard = trainArr.filter(x => discardable.includes(x)).diff(game.permanents);
      let thisPerms = trainArr.diff(TRAINS);
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
      
      let prevLength = canDiscard.length;
      let removed = canDiscard.splice(0, prevLength - cos[i].limit);
      let discarded = prevLength - canDiscard.length;
      if (discarded > 0) {
        results.change(trainsRow, cos[i].col, canDiscard.concat(thisPerms).join(","));
        
        let discardLoc = "";
        // NdeM does not discard to bank pool
        if (cos[i].name.toUpperCase() !== "NDEM") {
          discardLoc = "to bank pool ";
          // Add discarded trains to bank pool
          for (var j=0; j<removed.length; j++) {
            // Do not add 7 trains to bank pool; there is no spot for them
            // L trains are not added to bank pool
            if (removed[j] != "7" && removed[j] != "L") {
              let discardRow = bankPoolRow + parseInt(removed[j]) - 1;
              let curPoolTrains = results.data[discardRow][bankPoolCol];
              if (curPoolTrains.replace(/\s/g, '') == "") {
                results.change(discardRow, bankPoolCol + 2, 1);
              }
              else {
                results.change(discardRow, bankPoolCol + 2, parseInt(results.data[discardRow][bankPoolCol + 2]) + 1);
              }
            }
          }
        }
        let plural = discarded == 1 ? "" : "s";
        results.log(`${cos[i].name} discards ${discarded} train${plural} (` + removed.join(', ') + `) ${discardLoc}to meet limit of ${cos[i].limit}`);
      }
    }
    
    // Rust trains in bank pool
    for (let p in RUST) {
      // L trains never reach bank pool
      if (p <= phase && RUST[p] !== "L") {
        // If a train type has resulted, remove them from bought/available bank pool columns
        results.change(bankPoolRow + RUST[p] - 1, bankPoolCol + 2, 0);
        results.change(bankPoolRow + RUST[p] - 1, bankPoolCol + 3, 0);
      }
    }
    
    // Add "invalid trains" message to log
    if (trainErrors.length > 0) {
      let ignoreMsg = "Ignoring invalid trains: " + trainErrors.join("; ");
      results.log(ignoreMsg);
    }
    
    // RESOLVE PRIVATE BIDS
    var newPrivates = results.data[1].slice(colPrivateBids, colPrivateBids + PRIVATES_FOR_BIDDING);
    var soldPrivates = [];
    var lastPrivate;
    var privatesLeft = false;
    for (var i=0; i<PRIVATES_FOR_BIDDING; i++) {
      let private = results.data[1][colPrivateBids + i];
      let winner = results.data[winnerRow][colPrivateBids + i];
      
      // Is this item blank?
      if (private.toString().isBlank()) {
        let ignore = "No private in bid box " + (i+1);
        if (i < PRIVATES_FOR_BIDDING - 1) {
          ignore += ". Ignoring remaining bid boxes";
        }
        results.log(ignore);
        newPrivates.splice(i, PRIVATES_FOR_BIDDING - i);
        break;
      }
      
      // Is this item is the list of valid items?
      if (!PRIVATES.includes(private.toString().toUpperCase())) {
        results.error(`Private "${private}" in bid box ${i+1} not recognized`);
        return results.show();
      }
      lastPrivate = private;
      
      // Were there no bidders?
      if (winner == "-") {
        results.log(`No bidders on private ${private}`);
        privatesLeft = true;
      }
      else {
        // Private was sold
        newPrivates.splice(newPrivates.indexOf(private), 1);
        let winningBid = results.data[winningBidRow][colPrivateBids + i];
        
        // Add winner as owner for end of this round
        let privateNum = private.toString().extractNum(PRIVATES);
        results.change(privateOwnerRow + privateNum, privateOwnerCol, winner);
        
        results.log(`${winner} won private ${private} for $${winningBid}`);
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
        let privateDrawMatch = privateDraws.indexOf(lastPrivate);
        if (results.checkIndex(privateDrawMatch, lastPrivate + " in private draw pile")) { return results.show(); }
        if (privateDrawMatch < game.numPrivates - 1) {
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
      for (var i=0; i<newPrivates.length; i++) {
        results.change(1, colPrivateBids + i, newPrivates[i], true);
      }
    }
    results.log(privateOrder);
    
    // RESOLVE MAJOR CONCESSION BIDS
    // Concessions are removed in phase 5
    if (startPhase < 5) {
      var newConcessions = results.data[1].slice(colConcessionBids, colConcessionBids + CONCESSIONS_FOR_BIDDING);
      var soldConcessions = [];
      var lastConcession;
      var concessionsLeft = false;
      for (var i=0; i<CONCESSIONS_FOR_BIDDING; i++) {
        let concessionFull = results.data[1][colConcessionBids + i];
        let winner = results.data[winnerRow][colConcessionBids + i];
        
        // Is this FCM?
        let concession = concessionFull.toString();
        if (concession.toUpperCase().indexOf("FCM") > -1) {
          concession = "FCM";
        }
        
        // Is this item blank?
        if (concession.isBlank()) {
          let ignore = `No concession in bid box ${i+1}`;
          if (i < CONCESSIONS_FOR_BIDDING - 1) {
            ignore += ". Ignoring remaining bid boxes";
          }
          results.log(ignore);
          newConcessions.splice(i, CONCESSIONS_FOR_BIDDING - i);
          break;
        }
        
        // Is this item is the list of valid items?
        if (!game.majors.map(m => m.toUpperCase()).includes(concession.toUpperCase())) {
          results.error(`Major concession "${concession}" in bid box ${i+1} not recognized`);
          return results.show();
        }
        lastConcession = concession;
        
        // Were there no bidders?
        if (winner == "-") {
          results.log(`No bidders on ${concession} concession`);
          concessionsLeft = true;
        }
        else {
          // Concession was sold
          newConcessions.splice(newConcessions.indexOf(concessionFull), 1);
          let winningBid = results.data[winningBidRow][colConcessionBids + i];
          
          // Add winner as owner for end of this round
          let majorNum = game.majors.indexOf(concession) + 1;
          results.change(concessionOwnerRow + majorNum, concessionOwnerCol, winner);
          
          results.log(`${winner} won ${concession} concession for $${winningBid}`);
          
          // 1822MX: If this is FCM, also add the winner as director of M18
          if (concession == "FCM") {
            sold.push("M18");
            // Add minor share count to owner's row
            results.change(playerRow[winner], minorCol["M18"], 1);
            
            // No need to set player as director; this is done via formula
            
            // Starting price is always $50, starting treasury is always $100
            results.change(marketRow, minorCol["M18"], 50);
            results.change(miscRow, minorCol["M18"], 100);
            
            results.log(`${winner} is director of M18 as part of winning FCM concession. M18 valued at $50 with $100 in treasury`);
          }
        }
      }
      
      // Determine concessions to place in new bid boxes
      var concessionOrder = "All concessions have sold";
      if (lastConcession) {
        while (newConcessions.length < CONCESSIONS_FOR_BIDDING) {
          lastConcession = lastConcession.toString().toUpperCase();
          
          // Search for last concession in draw pile
          var concessionDrawMatch = concessionDraws.indexOf(lastConcession);
          if (results.checkIndex(concessionDrawMatch, `${lastConcession} in concession draw pile`)) { return results.show(); }
          if (concessionDrawMatch < game.numMajors - 1) {
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
        for (var i=0; i<newConcessions.length; i++) {
          results.change(1, colConcessionBids + i, newConcessions[i], true);
        }
      }
      results.log(concessionOrder);
    }
    else {
      results.log("Concessions were removed from play in phase 5");
    }
    if (sold.length > 0) {
      results.reminder("Update stock market for newly launched minors: " + sold.join(", "));
    }
    
    // CHECK FOR SOLD-OUT MAJORS
    var soldoutMajors = [];
    for (var i=0; i<game.numMajors; i++) {
      // Are all shares of this major sold?
      if (results.data[treasuryRow][majorsCol + i] == 0 && results.data[coBankPoolRow][majorsCol + i] == 0) {
        // Increment market value
        let curPrice = results.data[marketRow][majorsCol + i];
        if (game.stockPrices.includes(curPrice)) {
          let thisMajor = results.data[1][majorsCol + i];
          soldoutMajors.push(thisMajor);
          let stockMatch = game.stockPrices.indexOf(curPrice);
          if (stockMatch == -1) {
            results.error(`Stock price of $${curPrice} for major ${thisMajor} not valid`);
            return results.show();
          }
          let newPrice = game.stockPrices[Math.min(game.stockPrices.length - 1, stockMatch + 1)];
          results.change(marketRow, majorsCol + i, newPrice);
          let shareIncrease = `All shares of ${thisMajor} are sold.`
          if (curPrice == newPrice) {
            shareIncrease += ` Stock prices is already at maximum of $${curPrice}`;
          }
          else {
            shareIncrease += ` Stock price increases from $${curPrice} to $${newPrice}`;
            
            // Did this stock move out of the yellow zone?
            if (curPrice == YELLOW_ZONE_END && newPrice > curPrice) {
              shareIncrease += " (now out of yellow zone)";
              results.change(yellowZoneRow, majorsCol + i, "N");
            }
          }
          results.log(shareIncrease);
        }
        else {
          results.error(`Stock price $${curPrice} for major ${thisMajor} is not valid`);
          return results.show();
        }
      }
    }
    if (soldoutMajors.length > 0) {
      results.summarize("Soldout majors increased in stock value: " + soldoutMajors.join(", "));
      results.reminder("Increase the stock value on the board for soldout majors: " + soldoutMajors.join(", "));
    }
    
    // DETERMINE NEW PLAYER ORDER
    // Take previous player order into account 
    // P7 doubles a player's money for determining player order (in both 1822MX and 1822CA)
    var numPlayers = parseInt(results.data[0][1]);
    var ownerP7 = results.data[privateOwnerRow + 7][privateOwnerCol];
    var players = [];
    for (var i=0; i<numPlayers; i++) {
      let thisRow = headerRows + i;
      let playerName = results.data[headerRows + i][1];
      // In case of tie, retain player order from previous SR
      // To account for this, add a small amount <1 based on previous order
      let playerCash = (playerName == ownerP7 ? 2 : 1) * results.data[headerRows + i][4] + 0.1*(numPlayers - results.data[headerRows + i][0]);
      players.push({name: playerName, cash: playerCash, row: thisRow});
    }
    players.sort(function(a,b) {
      return ((a.cash > b.cash) ? -1 : ((a.cash < b.cash) ? 1 : 0));
    });
    // Update player order
    for (var i=0; i<numPlayers; i++) {
      results.change(players[i].row, 0, i + 1, true);
    }
    
    var playerOrder = players.map(a => a.name);
    results.log("New player order: " + playerOrder.join(', '));
  }
  
  // HOUSEKEEPING FOR OPERATING ROUNDS
  else if (results.currentType == "OR" && phase > 1) {
    results.reminder("Resolve minor acquisitions in new sheet (if applicable)");
  }
  
  // HOUSEKEEPING FOR ALL ROUNDS
  // These changes are made only on newly created sheet
  
  // Enter name of previous sheet
  results.change(prevSheetRow, prevSheetCol, results.currentName, true);
  
  // Set SR/OR
  results.change(typeRow, typeCol, results.newType, true);
  
  for (var i=0; i<9; i++) {
    // Clear out minor operational data
    for (var j=1; j<game.numMinors + 1; j++) {
      results.change(operateRow + i, minorCol[j.toString()], "", true);
    }
    
    // Clear out major operational data
    for (var j=0; j<game.numMajors + 1; j++) {
      results.change(operateRow + i, majorsCol + j, "", true);
    }
  }
  
  // Clear out optional LP, 2P, and 3/2 income for majors
  for (var j=0; j<game.numMajors + 1; j++) {
    results.change(operateRow + 10, majorsCol + j, "", true);
  }
  
  for (var i=0; i<game.maxPlayers; i++) {
    // Clear out SR bids
    for (var j=0; j<MINORS_FOR_BIDDING + PRIVATES_FOR_BIDDING + CONCESSIONS_FOR_BIDDING + 2; j++) {
      results.change(incomeRow + i, colPrivateBids + j, "", true);
    }
    
    // Clear out stock purchases
    results.change(incomeRow + i, incomeCol, "", true);
    
    // Clear out loans/misc
    results.change(incomeRow + i, incomeCol + 4, "", true);
    results.change(incomeRow + i, incomeCol + 5, "", true);
    if (game.name == "1822ca") {
      results.change(incomeRow + i, incomeCol + 6, "", true);
    }
  }
  
  // 1822CA
  if (game.name == "1822ca") {
    // Clear out P8 and P9 income
    for (var i=0; i<game.maxPlayers; i++) {
      results.change(incomeRow + i, p8Col, "", true);
      results.change(incomeRow + i, p9Col, "", true);
    }
    results.change(miscRow, p8Col, "", true);
    results.change(miscRow, p9Col, "", true);
    
    // Clear out tax row spending
    results.change(taxRow, incomeCol, "", true);
    results.change(taxRow, incomeCol + 6, "", true);
  }
  
  // SUMMARY WHEN CREATING A STOCK ROUND
  if (results.newType == "SR") {
    // Determine player order
    nextOrder = [];
    for (var i=0; i<numPlayers; i++) {
      var player = results.data[headerRows + i][1];
      var order = results.data[headerRows + i][0];
      nextOrder.push({"player": player, "order": order});
    }
    nextOrder.sort(function(a,b) { return a.order > b.order ? 1 : a.order < b.order ? -1 : 0; });
    for (var i=0; i<nextOrder.length; i++) {
      results.outline(nextOrder[i].player + " - ");
    }
  }
  
  // SUMMARY WHEN CREATING AN OPERATING ROUND
  else if (results.newType == "OR") {
    // Construct NdeM operation message for 1822MX
    var ndemMsg = "";
    if (game.name == "1822mx" && phase < 7 || ndemPrivatized) {
      let ndemPrice = results.data[marketRow][ndemCol];
      ndemMsg = "NdeM @" + ndemPrice + " - ";
      
      // Look for players with NdeM shares
      let ndemOperators = [];
      for (var i=0; i<numPlayers; i++) {
        if (results.data[headerRows + i][ndemCol] > 0) {
          let player = results.data[headerRows + i][1];
          let order = results.data[headerRows + i][0];
          ndemOperators.push({"player": player, "order": order});
        }
      }
      if (ndemOperators.length > 0) {
        // Sort the NdeM operators by player order
        ndemOperators.sort(function(a,b) {
          return a.order > b.order ? 1 : a.order < b.order ? -1 : 0;
        });
        for (var i=0; i<ndemOperators.length; i++) {
          ndemMsg += "\n--->" + ndemOperators[i].player + " - ";
        }
      }
      else {
        ndemMsg += "no shareholders";
      }
    }
    
    // If NdeM was just privatized, this is be the first step that happens
    // Otherwise, this step happens last
    if (ndemPrivatized) {
      ndemMsg += "\nNdeM now privatized";
      results.outline(ndemMsg);
    }
    
    // Determine minor operating order
    // First, create ordering for minors
    // Use tiebreakers if share price is the same for two minors
    // First tiebreaker: minors just launched should go after other minors
    // Second tiebreaker: draw pile order (minors higher in draw pile order should go before those lower)
    var openMinors = [];
    for (var i=0; i<game.numMinors; i++) {
      // Determine if this minor has a director
      let thisDirector = "";
      for (var j=0; j<numPlayers; j++) {
        if (results.data[headerRows + j][minorCol[i+1]] > 0) {
          thisDirector = results.data[headerRows + j][1];
          break;
        }
      }
      
      // Only consider a minor launched if someone has at least one share and there are no merger comments
      if (thisDirector !== "" && results.data[mergerCommentsRow][minorStartCol + i].trim() == "") {
        // Find match in minor draw pile
        let thisMatch = -1;
        for (var j=0; j<minorDraws.length; j++) {
          var a = minorDraws[j];
          if ( a == (i+1) || a == "M" + (i+1) || ( i+1 < 10 && a == "M0" + (i+1) ) ) {
            thisMatch = j;
            break;
          }
        }
        if (thisMatch == -1) { results.error("Error finding minor M${i+1} in minor draw pile."); return results.show(); }
        let thisMinor = results.data[1][minorStartCol + i];
        
        // Create weight on the interval (0,1) that favors minors higher in the draw pile
        let thisWeight = (game.numMinors - thisMatch - 1) / game.numMinors;
        
        // Subtract 1 from the weight if this minor was just launched
        // Only applies if current round is an SR
        if (results.currentType == "SR") {
          if (sold.indexOf(thisMinor) > -1 || sold.indexOf(thisMinor[0] + "0" + thisMinor.substr(1,2)) > -1) {
            thisWeight = thisWeight - 1;
          }
        }
        
        // Create weight on the interval 
        // Add to array of open minors
        openMinors.push({"name": thisMinor, "director": thisDirector, "sharePrice": results.data[marketRow][minorStartCol + i], "weight": thisWeight});
        
        // This minor should be visible in the next sheet
        results.visibleMinorCols.push(minorCol[i+1] + 1);
      }
      else {
        // This minor should be hidden in the next sheet
        results.hiddenMinorCols.push(minorCol[i+1] + 1);
      }
    }
    // Sort open minors based on the share price and the weight from the draw pile order
    openMinors.sort(function(a,b) {
      if (a.sharePrice + a.weight > b.sharePrice + b.weight) { return -1; }
      else if (a.sharePrice + a.weight < b.sharePrice + b.weight) { return 1; }
      else { return 0; }
    });
    
    // Determine major operating order
    // If a major just increased in value due to being sold out, it should go after other majors of the same value
    var openMajors = [];
    for (var i=0; i<game.numMajors; i++) {
      // Only consider a major launched if it has a director
      if (results.data[directorRow][majorsCol + i].trim() !== "") {
        let thisMajor = results.data[1][majorsCol + i];
        
        // Penalize majors that just increased in share price
        // Only applies if current round is an SR
        let thisWeight = 0;
        if (results.currentType == "SR") {
          thisWeight = soldoutMajors.indexOf(thisMajor) > -1 ? -1 : 0;
        }
        
        // Add to array of open majors
        openMajors.push({"name": thisMajor, "director": results.data[directorRow][majorsCol + i].trim(), "sharePrice": results.data[marketRow][majorsCol + i], "weight": thisWeight});
      }
    }
    // Sort open majors based on share price
    // We do not consider draw pile order, as it has virtually nothing to do with major share price
    openMajors.sort(function(a,b) {
      if (a.sharePrice + a.weight > b.sharePrice + b.weight) { return -1; }
      else if (a.sharePrice + a.weight < b.sharePrice + b.weight) { return 1; }
      else { return 0; }
    });
    
    // Add open minors/majors to outline
    for (var i=0; i<openMinors.length; i++) {
      results.outline(openMinors[i].name + " @" + openMinors[i].sharePrice + " (" + openMinors[i].director + ") - ");
    }
    for (var i=0; i<openMajors.length; i++) {
      results.outline(`${openMajors[i].name} @${openMajors[i].sharePrice} (${openMajors[i].director}) - `);
    }
    
    // If NdeM was not just privatized, it operates last
    if (game.name == "1822mx" && phase < 7) {
      results.outline(ndemMsg);
    }    
    
    if (openMinors.length + openMajors.length > 0) {
      results.outline("");
      results.outline("Order for companies with same share price may not be correct.");
    }
  }
  
  // Prompt user with results
  return results.show();
}

// Create new round from saved user property data
function confirmNewRound() {
  // Get queued changes
  var queuedChanges = getQueuedChanges();
  
  // Override changed data in specified sheet
  var source = SpreadsheetApp.getActiveSpreadsheet();
  var curSheet = source.getSheetByName(queuedChanges.currentName);
  var data = curSheet.getRange(1, 1, queuedChanges.lastRow, queuedChanges.lastCol).getValues();
  
  // setValues() overrides formulas, and setFormulas() overrides values
  // RangeList objects cannot be used to simultaneously set different values
  // Workaround: set all formulas as strings
  // Allows single Range.setValues() call at end, rather than multiple calls to Range.setValue()
  var formulas  = curSheet.getRange(1, 1, queuedChanges.lastRow, queuedChanges.lastCol).getFormulas();
  data = data.map(function(row, i) {
    return row.map(function(val, j) {
      var formula = formulas[i][j];
      // If a formula exists, return it. Otherwise, return the cell value
      return (formula ? formula : val);
    });
  });
  
  var changeArr = queuedChanges.changes;
  for (var i=0; i<changeArr.length; i++) {
    if (!changeArr[i][3]) {
      data[changeArr[i][0]][changeArr[i][1]] = changeArr[i][2];
    }
  }
  
  // Set values
  curSheet.getRange(1, 1, queuedChanges.lastRow, queuedChanges.lastCol).setValues(data);
  SpreadsheetApp.flush();
  
  // Copy to new spreadsheet
  var newSheet = curSheet.copyTo(source);
  
  // Rename sheet and move
  newSheet.setName(queuedChanges.newName);
  newSheet.activate();
  source.moveActiveSheet(0);
  
  // Add "delayed" changes
  for (var i=0; i<changeArr.length; i++) {
    if (changeArr[i][3]) {
      data[changeArr[i][0]][changeArr[i][1]] = changeArr[i][2];
    }
  }
  
  // Update values
  newSheet.getRange(1, 1, queuedChanges.lastRow, queuedChanges.lastCol).setValues(data);
  SpreadsheetApp.flush();
  
  // Hide/unhide minor columns
  // Perform this in bulk with Sheet.hideColumns()/Sheet.showColumns for efficiency
  
  // Hide columns that are visible but should be hidden
  let hideCols = queuedChanges.hiddenMinorCols;
  for (var i=0; i<hideCols.length; i++) {
    let coli = hideCols[i];
    if (!newSheet.isColumnHiddenByUser(coli)) {
      let consecutive = 1;
      for (var j=i+1; j<hideCols.length; j++) {
        if (hideCols[j] == coli + 1 && !newSheet.isColumnHiddenByUser(hideCols[j])) {
          coli = hideCols[j]
          consecutive++;
        }
        else {
          break;
        }
      }
      newSheet.hideColumns(hideCols[i], consecutive);
      i += consecutive - 1;
    }
  }
  // Reveal columns that are hidden but should be visible
  let visCols = queuedChanges.visibleMinorCols;
  for (var i=0; i<visCols.length; i++) {
    let coli = visCols[i];
    if (newSheet.isColumnHiddenByUser(coli)) {
      let consecutive = 1;
      for (var j=i+1; j<hideCols.length; j++) {
        if (visCols[j] == coli + 1 && newSheet.isColumnHiddenByUser(visCols[j])) {
          coli = visCols[j]
          consecutive++;
        }
        else {
          break;
        }
      }
      newSheet.showColumns(visCols[i], consecutive);
      i += consecutive - 1;
    }
  }
    
  // If specified, copy protections from old sheet to new sheet
  // All protections in new sheet will be warning-only
  if (queuedChanges.protect) {
    var protections = curSheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    for (var i=0; i<protections.length; i++) {
      let prot = protections[i];
      let protRange = prot.getRange().getA1Notation();
      let newProt = newSheet.getRange(protRange).protect().setWarningOnly(true);
    }
  }
  
  // Protect previous sheet
  // Helps prevent players from accidentally entering data into a previous round's sheet
  curSheet.protect().setWarningOnly(true);
  
  // Display outline. Stucture is:
  // Name of new round
  //   Summary
  //   
  //   Order outline
  //   
  //   Reminders
  var ui = SpreadsheetApp.getUi();
  outlineMsg = queuedChanges.newName;
  if (queuedChanges.summary.length > 0) {
    outlineMsg += "\n" + queuedChanges.summary.join("\n");
  }
  if (queuedChanges.outlines.length > 0) {
    outlineMsg += "\n\n" + queuedChanges.outlines.join("\n");
  }
  if (queuedChanges.reminders.length > 0) {
    outlineMsg += "\n\nDon't forget!\n" + queuedChanges.reminders.map(value => "- " + value).join("\n");
  }
  ui.alert("Outline for " + queuedChanges.newName, outlineMsg, ui.ButtonSet.OK);
}

// For debugging
function testCreateNewRound() {
  let gameName = "1822ca";
  let newName = "test-or";
  let newType = "OR";
  let currentName = "test-sr";
  let fo = { "gameName": gameName, "newName": newName, "newType": newType, "currentName": currentName };
  createNewRoundWrapper(fo);
}
