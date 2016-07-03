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
    alreadyRunning = true;
    var id = folderId.pop();

    //Check if blacklisted
    if (isBlacklisted(id)) {
        var folderTitle = bmsvc.getItemTitle(id);
        console.log("Skipping blacklisted folder: " + folderTitle + " with id " +
            id + "\n");
        //Keep processing queued folders
        if (folderId.length > 0) {
            timer.setTimeout(sortItems, 0);
        } else {
            alreadyRunning = false;
            isRecursive = false;
            emit(exports, "completed");
        }
        return;
    }

    //Get folder content
    console.log("I'm sorting folder: " + bmsvc.getItemTitle(id) + " with id " +
        id + "\n");
    var query = historyService.getNewQuery();
    query.setFolders([id], 1);
    var result = historyService.executeQuery(query, options);
    var rootNode = result.root;
    rootNode.containerOpen = true;

    //Sort items
    if (simplePrefs.prefs.mustSortFolderFirst) {
        sortFolderFirst(rootNode, isRecursive);
    } else {
        sortSimple(rootNode, isRecursive);
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
Sort WITHOUT putting the folders before the bookmarks.

The bookmark order in the UI is determined by the "index" property of the item.
The items are already sorted by our caller according to the user options. We must
simply replicate the rootNode order into the "index" property of the node.

1. iterate all the child of the rootNode
2. if the child is a folder, append the ID to the array folderId to be scanned
    later
3. set correct order changing the "index" property
*/
function sortSimple(rootNode, isRecursive) {
    var i, node;
    for (i = 0; i < rootNode.childCount; i++) {
        node = rootNode.getChild(i);
        if (isRecursive && node.type === node.RESULT_TYPE_FOLDER) {
            folderId.push(node.itemId);
        }
        //Skip sorting if we are in "Bookmark Menu" and option is set
        if(rootNode.itemId === bmsvc.bookmarksMenuFolder &&
            simplePrefs.prefs.mustSkipRootFolder === true) {
            console.log("Skipping root folder because of user preference");
        } else {
          bmsvc.setItemIndex(node.itemId, i);
        }
    }
}

/*
This is like sortSimple but the folders will be placed before the bookmarks.

In sortSimple there is only an index to determine the item "index" (so the order).
Here there are two index, one for the folders and one for the bookmarks. The two
index have an offset consisting in the number of folders in the node

1. calculate how many folder there are
2. iterate the root childs
3. in case of a folder set index to i
*/
function sortFolderFirst(rootNode, isRecursive) {
    var i, node,
        folderCount = 0,
        folderIndex = 0,
        bookmarkIndex = 0;

    //Get folder count
    for (i = 0; i < rootNode.childCount; i++) {
        node = rootNode.getChild(i);
        if (node.type === node.RESULT_TYPE_FOLDER) {
            folderCount++;
        }
    }

    bookmarkIndex = folderCount;
    for (i = 0; i < rootNode.childCount; i++) {
        node = rootNode.getChild(i);
        if (node.type === node.RESULT_TYPE_FOLDER) {
            if (isRecursive) {
                folderId.push(node.itemId);
            }
            //Skip sorting if we are in "Bookmark Menu" and option is set
            if(rootNode.itemId === bmsvc.bookmarksMenuFolder &&
               simplePrefs.prefs.mustSkipRootFolder === true) {
                console.log("Skipping root folder because of user preference");
                continue;
            }
            bmsvc.setItemIndex(node.itemId, folderIndex);
            folderIndex++;
        } else {
            //Skip sorting if we are in "Bookmark Menu" and option is set
            if(rootNode.itemId === bmsvc.bookmarksMenuFolder &&
               simplePrefs.prefs.mustSkipRootFolder === true) {
                console.log("Skipping root folder because of user preference");
                continue;
            }
            bmsvc.setItemIndex(node.itemId, bookmarkIndex);
            bookmarkIndex++;
        }
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

        //Get options
        switch (simplePrefs.prefs.sortBy) {
        case 0:
            options.sortingMode = options.SORT_BY_TITLE_ASCENDING;
            break;
        case 1:
            options.sortingMode = options.SORT_BY_URI_ASCENDING;
            break;
        case 2:
            options.sortingMode = options.SORT_BY_DATE_ASCENDING;
            break;
        default:
            options.sortingMode = options.SORT_BY_TITLE_ASCENDING;
            break;
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
