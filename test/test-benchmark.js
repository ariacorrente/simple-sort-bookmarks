/*
This test is a benchmark:
1- generate a lot of random bookmarks
2- sort the bookmarks
3- print out the time required to perform the sorting
 */
var sorter = require("lib/bookmarkSorter");

var {
    Cc, Ci
} = require("chrome");
var historyService = Cc["@mozilla.org/browser/nav-history-service;1"]
    .getService(Ci.nsINavHistoryService);
var bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
    .getService(Ci.nsINavBookmarksService);
var options = historyService.getNewQueryOptions();
options.sortingMode = options.SORT_BY_TITLE_ASCENDING;
var ios = Cc["@mozilla.org/network/io-service;1"]
    .getService(Ci.nsIIOService);

function getRootNode() {
    var query = historyService.getNewQuery();
    query.setFolders([bmsvc.bookmarksMenuFolder], 1);
    var result = historyService.executeQuery(query, options);
    var rootNode = result.root;
    rootNode.containerOpen = true;
    return rootNode;
}

function printBookmarks(label) {
    var rootNode = getRootNode();
    var node;
    console.log("# " + label + " #");

    for (var i = 0; i < rootNode.childCount; i++) {
        node = rootNode.getChild(i);
        console.log(i + "| Node id: " + node.itemId + " bookmarkIndex: " +
            node.bookmarkIndex + " title: " + node.title +
            " uri: " + node.uri);
    }
}

function addBookmark(title, address) {
    var uri = ios.newURI(address, null, null);
    bmsvc.insertBookmark(bmsvc.bookmarksMenuFolder, uri, bmsvc.DEFAULT_INDEX,
        title);
}

function getRandomString() {
    var maxStringLength = 16;
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    var stringLength = Math.floor(Math.random() * maxStringLength)
    var text = "";

    for(var i = 0; i < stringLength; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/*
 * The sorting function is asynchronous so I need an asynchronous test.
 * Async test require an extra function parameter, in this case "done"
 * When the async computation is completed call "done()"
 */
exports["test benchmark sorting"] = function (assert, done) {
    var bookmarksCount = 100;
    var title = "";
    var startDate = 0;
    var endDate;
    var timeElapsed = 0;

    console.log("Benchmarking sorting of " + bookmarksCount + " bookmarks");
    //printBookmarks("### BOOKMARKS BEFORE ###");
    startDate = Date.now();
    for (var i = 0; i < bookmarksCount; i++) {
        title = getRandomString();
        addBookmark(title, "http://www." + title + ".com");
    }
    endDate = Date.now();
    timeElapsed = endDate - startDate;
    console.log("Time required to generate bookmarks: " + timeElapsed + "ms");

    //printBookmarks("### BOOKMARKS GENERATED ###");

    sorter.on("completed", function () {
        endDate = Date.now();
        timeElapsed = endDate - startDate;
        console.log("Sort bookmarks completed in " + timeElapsed + "ms");
        assert.ok(true, "Benchmark completed");
        done();
    });
    startDate = Date.now();
    sorter.sortFolder(bmsvc.bookmarksMenuFolder);
    console.log("Waiting for async sort to complete...");

    //printBookmarks("### BOOKMARKS SORTED ###");
}
require("sdk/test").run(exports);
