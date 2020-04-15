/*
 * @OnlyCurrentDoc
 */

// Stores specific rules data for each supported 1822-style game

function supportedGames() {
  return ["1822mx", "1822ca"];
}

function getSetup(game) {
  if (game == "1822mx") {
    var minPlayers = 3;
    var maxPlayers = 5;
    var majors = ["CHP", "FCM", "FCP", "FNM", "IRM", "MC", "MIR", "NdeM"];
    var numMinors = 24;
    var numPrivates = 18;
    var numMajors = majors.length - 1; // exclude NdeM
    var stockPrices = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 135, 150, 165, 180, 200, 220, 245, 270, 300, 330, 360, 400, 450, 500, 550, 600];
    var permanents = ["2P", "P2", "3/2", "3/2P", "P3/2", "LP", "PL", "P+", "+"];
    var incomeHeaders = ["Stock", "Pvts/Conc", "Divs", "Bids", "Loan +/-", "Misc"];
    var minorDirectorShares = 1;
    var minorHeaderText = "Minor Companies (president gets 1 cert for a minor. Enter a 1 for the president)";
  }
  else if (game == "1822ca") {
    var minPlayers = 3;
    var maxPlayers = 7;
    var majors = ["CNoR", "CP", "GNW", "GT", "GTP", "GWR", "IC", "NTR", "PGE", "QMOO"];
    var numMinors = 30;
    var numPrivates = 30;
    var numMajors = majors.length;
    var stockPrices = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 135, 150, 165, 180, 200, 220, 245, 270, 300, 330, 360, 400, 450, 500, 550, 600, 650, 700];
    var permanents = ["2P", "P2", "LP", "PL", "P+", "+", "G"];
    var incomeHeaders = ["Stock", "Pvts/Conc", "Divs", "Bids", "Loans", "Loan Int", "Misc"];
    var minorDirectorShares = 2;
    var minorHeaderText = "Minor Companies (president gets 2 certs for a minor. Enter a 2 for the president)";
  }
  else {
    return null;
  }
  
  return { "name": game, "minPlayers": minPlayers, "maxPlayers": maxPlayers, "majors": majors, "numMinors": numMinors, "numPrivates": numPrivates, "numMajors": numMajors, "stockPrices": stockPrices, "permanents": permanents, "incomeHeaders": incomeHeaders, "minorDirectorShares": minorDirectorShares, "minorHeaderText": minorHeaderText};
}
