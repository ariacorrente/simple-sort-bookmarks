/*
Copyright 2014, Nicola Felice

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

"use strict";

var {
    Cc, Ci
} = require("chrome");
var {
    emit, on, once, off
} = require("sdk/event/core");
var timer = require("sdk/timers");
var simplePrefs = require("sdk/simple-prefs");
var historyService = Cc["@mozilla.org/browser/nav-history-service;1"]
    .getService(Ci.nsINavHistoryService);
var bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
    .getService(Ci.nsINavBookmarksService);
var options = historyService.getNewQueryOptions();

// Set to true when a sorting is running. This allows the current sorting
// procedure not to trigger a new sorting request by the bookmark listener
var alreadyRunning = false;
// Queue of folder id to be sorted
var folderId = [];
/*
When true will be sorted also the child folders of the one in the queue.
This is declared at module's root level because i don't know how to add
parameters to the callback function  used by the timer.
*/
var isRecursive = false;
//Folder ids not to be sorted
var blacklist = [];

function setBlacklist(list) {
    blacklist = list;
}

function setBatchMode(isBatchMode) {
    console.log("BatchMode set to " + isBatchMode + "\n");
    //Stop if i'm sorting now
    if (isBatchMode) {
        isRecursive = false;
        folderId = [];
        alreadyRunning = true;
    } else {
        alreadyRunning = false;
    }
}

function isBlacklisted(folderId) {
    for (var i = 0; i < blacklist.length; i++) {
        if (blacklist[i] === folderId) {
            return true;
        }
    }
    return false;
}

/*
1. get the first bookmark id stored in the array "folderId"
2. check if blacklisted and skip in this case
3. get all items in the folder
4. sort using the correct function (with folder first or not)
5. if there are more folders in the folderId array launch the timer to go on
*/
function sortItems() {
    var i, node, sepCount = 0, sepIndex = 0, start = 0,
        bookmarks = [[]], folders = [[]], items = [], order = [];
    alreadyRunning = true;
    var id = folderId.pop();
    var title = bmsvc.getItemTitle(id);

    //Check if blacklisted
    if (isBlacklisted(id)) {
        console.log("Skipping blacklisted folder: " + title + " with id " + id + "\n");
    } else {
        //Get folder content
        console.log("I'm sorting folder: " + title + " with id " + id + "\n");
        var query = historyService.getNewQuery();
        query.setFolders([id], 1);
        var result = historyService.executeQuery(query, options);
        var rootNode = result.root;
        rootNode.containerOpen = true;

        //Sort items
        for (i = 0; i < rootNode.childCount; i++) {
            node = rootNode.getChild(i);
            if (node.type === node.RESULT_TYPE_SEPARATOR) {
                sepCount++;
                bookmarks[sepCount] = [];
                folders[sepCount] = [];
            } else if (node.type === node.RESULT_TYPE_FOLDER) {
                title = bmsvc.getItemTitle(node.itemId).toLowerCase();
                folders[sepCount].push(title);
                if (isRecursive) {
                    folderId.push(node.itemId);
                }
            } else {
                title = bmsvc.getItemTitle(node.itemId).toLowerCase();
                bookmarks[sepCount].push(title);
            }
        }

        for (i = 0; i <= sepCount; i++) {
            if (simplePrefs.prefs.mustSortFolderFirst) {
                items[i] = folders[i].sort().concat(bookmarks[i].sort());
            } else {
                items[i] = folders[i].concat(bookmarks[i]).sort();
            }
        }

        for (i = 0; i < rootNode.childCount; i++) {
            node = rootNode.getChild(i);
            if (node.type === node.RESULT_TYPE_SEPARATOR) {
                sepIndex++;
                start = i + 1;
            } else {
                title = bmsvc.getItemTitle(node.itemId).toLowerCase();
                order[node.itemId] = start + items[sepIndex].indexOf(title);
            }
        }

        for (i in order) {
            bmsvc.setItemIndex(i, order[i]);
        }
    }

    //Keep processing queued folders
    if (folderId.length > 0) {
        timer.setTimeout(sortItems, 0);
    } else {
        alreadyRunning = false;
        isRecursive = false;
        emit(exports, "completed");
    }
}

/*
Initialize the query options and call sortItems to start the effective sorting
*/
function sortFolder(newId, sortChild) {
    if (!alreadyRunning) {
        alreadyRunning = true;
        folderId.push(newId);
        isRecursive = sortChild;

        //Show work in progres dialog
        if (isRecursive) {
            emit(exports, "sortStarted");
        }

        timer.setTimeout(sortItems, 100);
    }
}

/*
Sort recursivly from the root folder
This is usefull to avoid to include the bookmark service in other places only to
access the bookmarkMenuFolder enumerator.
*/
function sortEverything() {
    sortFolder(bmsvc.bookmarksMenuFolder, true);
}

exports.sortFolder = sortFolder;
exports.sortEverything = sortEverything;
exports.setBlacklist = setBlacklist;
exports.setBatchMode = setBatchMode;

exports.on = on.bind(null, exports);
exports.once = once.bind(null, exports);
exports.removeListener = function removeListener(type, listener) {
    off(exports, type, listener);
};
