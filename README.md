
# 1822 automatic round generator for Google Sheets

This is an automatic round generator for 1822-style games in Google Sheets. The supported games and links to their corresponding Google Sheets documents are below.

* [1822CA (full map)](https://docs.google.com/spreadsheets/d/15jnmCJ9VuseIv2GcbuPA-qvkE2jV9F0pYEVA4xVc-6c/edit?usp=sharing) - based on template by Bob Lecuyer
* [1822MX](https://docs.google.com/spreadsheets/d/1DuOTSOAqH1c4XfLEcM2RXNUfq-yXfz1IhUx4m5SqqnQ/edit?usp=sharing) - based on template by Scott Petersen

The round generator has already been added to each spreadsheet. The spreadsheets linked above are read-only; to use them, save a copy to your own Google Drive with File->"Make a copy" and share the sheet with the other players in your game. The script only works on a desktop computer.

## What does it do?

When creating a new round from an existing operating round, the script will create a new sheet with all round-specific information (operational data, stock purchases, miscellaneous income, etc.) cleared.

When creating a new operating round from an existing stock round, the script does the following:

1. Resolves private bids and assigns the winners as owners
2. Resolves minor bids, sets the starting value and treasury, and assigns the director
3. Resolves concession bids and assigns the winners as owners
4. In phases 1 and 2, trains are exported based on the number of unsold minors. In phases 1-6, an additional train is exported if the minor in bid box 1 is unsold. This can trigger phase changes, which in turn can cause trains to be rusted or discard. The script handles train rusting and discarding.
5. Increases stock prices for sold-out majors
6. Creates a new sheet and clears out all round-specific information
7. Updates private, minor, and concession bid boxes with the next set of companies
8. Locks the previous sheet to prevent players from inadvertently editing the wrong sheet. Optionally copies cell protections from the previous sheet to prevent players from editing important header/formula cells.

Once the round is generated, an outline for the new round is presented. This can be copied into (e.g.) a Google Doc or forum thread to outline the new round for games played via email/post. My group uses [Board18](https://dev2.board18.org/) for the map, a Google Sheets document to manage the game, a Google Docs document for the log, and a Google Group for making "moves" and sending out email alerts.


## How do I use it?

1. Navigate to 1822->"Create new round" from the menu. The first time you run this, you will have to give the script permission to view and modify the sheet, as well as display content in sidebars and dialogs (see the FAQs). The script does *not* have permission to access any other information related to your Google Drive folder or account.

![Menu item](/img/menu.png)

2. Complete the dialog box with information about the round you would like to generate. There is an option to copy cell protections from the previous sheet. These protections are already added to the SR1 sheet of each template. They are useful for preventing players from accidentally overwriting formula-based cells. However, copying protections is a surprisingly time-consuming task in Google Sheets, so this may add several seconds to the script's runtime.

![New round dialog](/img/new_round.png)

3. Click "Create!". If the current round is an operating round, you are done! The new tab will be automatically created. If the current round is a stock round, you will first be asked to confirm what the round generator is doing. This is because creating an operating round from a stock round can be tricky and error-prone (even for the human players!).

![Confirm new round](/img/sidebar.png)

4. An outline for the new round is printed.

![New round outline](/img/outline.png)

Please do not edit cells that serve as headers for other cells (e.g., cells with text like "Trains", "Previous Sheet", etc.). Their contents help the script locate where everything is in the sheet.

## FAQs

### This app isn't verified!?
No, it's not published. You will have to give the script read/write access to the Google Sheet the first time you run it. On the "This app isn't verified" screen, click "Advanced", then "Go to 1822 (unsafe)".

![Unverified app](/img/unverified.png)

Clicking "Allow" gives the script the permission to read and write to the specific Google Sheet, as well as display content in prompts and sidebars. The script does not have any other permissions or access to your Google Drive.

The code is visible at Tools->Script editor.

### "Unable to locate" something?
This error means that the script can't find a certain group of cells, because the contents of the cell(s) it uses to locate them has changed. Only non-formulaic player, bidding, market, ownership, and operational data should be modified.

### "Invalid trains"? What does that mean?
A company's trains must be separated by commas. The following are recognized as valid train types for the games in which they are included: E, 7, 6, 5, 4, 3, 2, L, 2P, P2, 3/2, 3/2P, P3/2, LP, PL, P, P+, +, and G. If any other trains are listed in a company's train cell (or trains from this list that do not belong in a particular game), the script will not run until these train cells are fixed. This is important for properly rusting and discarding trains during phase changes triggered by train exports at the end of a stock round.

### I found a bug!
Good job! This is my first project using JavaScript/Google Apps Script, so I suppose we could have seen this coming. Please open an issue for problems that you find. It would be very helpful if you can provide a link to an example sheet for which the round generator behaves incorrectly.

### Does this work on mobile?

No. Unfortunately, the user-interface environment invoked by the script is not supported on Google Sheets mobile apps.
