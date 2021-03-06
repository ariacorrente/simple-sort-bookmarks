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

function getTestData() {
    var node;
    var data = [];
    var rootNode = getRootNode();
    for (var i = 0; i < rootNode.childCount; i++) {
        node = rootNode.getChild(i);
        data.push({
            "uri": node.uri,
            "title": node.title,
            "id": node.itemId,
            "bookmarkIndex": node.bookmarkIndex
        });
    }
    return data;
}

function populateBookmarksLibrary(testData) {
    var rootNode = getRootNode();
    for (var i = 0; i < testData.length; i++) {
        var uri = ios.newURI(testData[i].uri, null, null);
        testData[i].id = bmsvc.insertBookmark(bmsvc.bookmarksMenuFolder, uri,
            bmsvc.DEFAULT_INDEX,
            testData[i].title);
    }
}

function dumpObjectIndented(obj, indent) {
    var result = "";
    if (indent === null || indent === undefined) {
        indent = " ";
    }

    for (var property in obj) {
        var value = obj[property];
        if (typeof value == 'string')
            value = "'" + value + "'";
        else if (typeof value == 'object') {
            if (value instanceof Array) {
                // Just let JS convert the Array to a string!
                value = "[ " + value + " ]";
            } else {
                // Recursive dump
                // (replace "  " by "\t" or something else if you prefer)
                var od = dumpObjectIndented(value, indent + "  ");
                // If you like { on the same line as the key
                //value = "{\n" + od + "\n" + indent + "}";
                // If you prefer { and } to be aligned
                value = "\n" + indent + "{\n" + od + "\n" + indent + "}";
            }
        }
        result += indent + "'" + property + "' : " + value + ",\n";
    }
    return result.replace(/,\n$/, "");
}

function removeBookmarks() {
    var rootNode = getRootNode();
    var node;
    for (var i = 0; i < rootNode.childCount; i++) {
        node = rootNode.getChild(i);
        console.log("Removing Node id: " + node.itemId + " title: " +
            node.title + " uri: " + node.uri);
        bmsvc.removeItem(node.itemId);
    }
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

/*
a and b are arrays of object of type
{ "uri": <string>,
  "title": <string>,
  "id": <int>,
  "bookmarkIndex": <int> }
Two arrays are equal if the bookmarkIndex of items of the same title is equal
*/
function arraysAreEquals(a, b) {
    if (a.length !== b.length) {
        console.log("array have different length: " + a.length + " != " + b.length);
        return false;
    }
    for (var i = 0; i < a.length; i++) {
        for (var j = 0; j < b.length; j++) {
            //Search for the same bookmark id
            if (a[i].title === b[j].title) {
                if (a[i].bookmarkIndex !== b[j].bookmarkIndex) {
                    console.log("bookmark id " + a[i].id +
                        " have different order " + a[i].bookmarkIndex +
                        "!=" + b[j].bookmarkIndex);
                    return false;
                }
            }
        }
    }
    return true;
}

//
// DISABLED
//
//This test is disabled because it never worked reliably
//The code is kept because can be used as base for new tests.
//exports["test sortFolder"] = function (assert) {
function disabledTest(assert) {
    var i, node;
    var testData = [
        {
            "uri": "http://acciderbolina.it",
            "title": "Acciderbolina"
        },
        {
            "uri": "http://zeta.com",
            "title": "Zeta"
        },
        {
            "uri": "http://pulcinopio.com",
            "title": "pulcinopio"
        },
        {
            "uri": "http://magoronzo.org",
            "title": "Magoronzo"
        },
        {
            "uri": "http://topogigio.com",
            "title": "TopoGigio"
        },
        {
            "uri": "http://gargamella.com",
            "title": "Gargamella"
        },
    ];
    /*
    I cant use string.localeCompare() because the result are different from the
    one generated by the History sistem.
    - The bookmark Mozilla Firefox is un-removable and un-sortably placed at
        position 0
    - The space and the empty string is handled differently
    */
    var expectedResult = [
        {
            title: 'Mozilla Firefox',
            bookmarkIndex: 0
        },
        /*{
            title: '',
            bookmarkIndex: 1
        },*/
        {
            title: 'Acciderbolina',
            bookmarkIndex: 2
        },
        {
            title: 'Gargamella',
            bookmarkIndex: 3
        },
        {
            title: 'Magoronzo',
            bookmarkIndex: 4
        },
        {
            title: 'pulcinopio',
            bookmarkIndex: 5
        },
        {
            title: 'Recently Bookmarked',
            bookmarkIndex: 6
        },
        {
            title: 'Recent Tags',
            bookmarkIndex: 7
        },
        {
            title: 'TopoGigio',
            bookmarkIndex: 8
        },
        {
            title: 'Zeta',
            bookmarkIndex: 9
        },
    ];
    /*
    Prepare test data
    */
    //printBookmarks("Default bookmarks");


    removeBookmarks();
    printBookmarks("Cleared bookmarks");


    populateBookmarksLibrary(testData);
    //printBookmarks("Bookmarks populated");

    //Read data before sorting
    var testDataBefore = getTestData();
    //console.log("testDataBefore before sorting\n" + dumpObjectIndented(testDataBefore));
    //console.log("Now i'm sorting the bookmark folder");
    sorter.sortFolder(bmsvc.bookmarksMenuFolder);

    var testDataAfter = getTestData();
    console.log("Result from sorter:\n" + dumpObjectIndented(testDataAfter));

    //printBookmarks("Bookmarks sorted");

    console.log("expectedResult\n" + dumpObjectIndented(expectedResult));

    var isEqual = arraysAreEquals(testDataAfter, expectedResult);
    assert.ok(isEqual, "Sort by title: NON WORKING TEST, RESULTS KEEP CHANGING FROM VERSION TO VERSION OF FIREFOX");
};

require("sdk/test").run(exports);
