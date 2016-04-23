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

var simplePrefs = require("sdk/simple-prefs");
//Chrome components
var Cc, Ci;
//Bookmark Services
var bmsvc;

//sorter is loaded in initBookmarkSorter
//I don't think the user will change the bookmarks every session so is useless
//to initialize this too soon.
var sorter;
//Advanced options storage handler
//Initialized together with "sorter"
var storageHandler;
//Button to open the advanced option tab, it's placed in the toolbar
var button;
//Module for opening a tab containing the advanced options
var advancedOption;

function initButtonAdvancedOptions() {
    if (simplePrefs.prefs.isButtonEnabled) {
        if (button === undefined) {
            var buttons = require('sdk/ui/button/action');
            button = buttons.ActionButton({
                id: "buttonOpenAdvancedOptions",
                label: "SimpleSort Bookmaks",
                icon: {
                    "16": "./icon-16.png",
                    "32": "./icon-32.png",
                    "64": "./icon-64.png"
                },
                onClick: openAdvancedOptions
            });
        }
    } else {
        if (button !== undefined) {
            button.destroy();
            button = undefined;
        }
    }
}

function openAdvancedOptions() {
    if (advancedOption === undefined) {
        advancedOption = require("./advancedOptionsTab");
        initBookmarkSorter();
    }
    advancedOption.init(sorter, storageHandler);
    advancedOption.openTab();
}

/*
Initialize bookmarkSorter and storageHandler
*/
function initBookmarkSorter() {
    if (storageHandler === undefined) {
        storageHandler = require("./storageHandler");
    }
    if (sorter === undefined) {
        sorter = require("./bookmarkSorter");
        sorter.setBlacklist(storageHandler.getBlacklistedFolders());
    }
}

/*
 * Bookmarks observer
 */
function handleItemChanged(aItemId, aProperty, aIsAnnotationProperty, aNewValue,
    aLastModified, aItemType, aParentId, aGUID, aParentGUID) {
    // Sort only if the property changed is the same i'm sorting by
    var s = simplePrefs.prefs.sortBy;
    if ((s == 0 && aProperty == "title") || (s == 1 && aProperty == "uri")) {
        initBookmarkSorter();
        sorter.sortFolder(aParentId, false);
    }
}

function handleItemAdded(aItemId, aParentId, aIndex, aItemType, aURI, aTitle,
    aDateAdded, aGUID, aParentGUID) {
    initBookmarkSorter();
    sorter.sortFolder(aParentId, false);
}

function handleItemMoved(aItemId, aOldParent, aOldIndex, aNewParent, aNewIndex) {
    initBookmarkSorter();
    sorter.sortFolder(aNewParent, false);
}

function handleBeginUpdateBatch() {
    initBookmarkSorter();
    sorter.setBatchMode(true);
}

function handleEndUpdateBatch() {
    initBookmarkSorter();
    sorter.setBatchMode(false);
}
var bookmarkListener = {
    onBeginUpdateBatch: handleBeginUpdateBatch,
    onEndUpdateBatch: handleEndUpdateBatch,
    onItemAdded: handleItemAdded,
    onItemChanged: handleItemChanged,
    onItemMoved: handleItemMoved,
    //It's useless to listen for Visited and removed events
    //onItemVisited: function(aBookmarkId, aVisitID, time) {},
    //onItemRemoved: function(aItemId, aFolder, aIndex) {},
};

function initBookmarkListener() {
    if (simplePrefs.prefs.mustAutoSort) {
        if (bmsvc === undefined) {
            Cc = require('chrome').Cc;
            Ci = require('chrome').Ci;
            bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
                .getService(Ci.nsINavBookmarksService);
        }
        bmsvc.addObserver(bookmarkListener, false);
    } else {
        if (bmsvc !== undefined) {
            bmsvc.removeObserver(bookmarkListener);
        }
    }
}

//Called by firefox at addon load time
function main(options, callbacks) {
    console.log("Loading SimpleSort bookmarks cause: " + options.loadReason);
    simplePrefs.on("openAdvancedOptions", openAdvancedOptions);
    simplePrefs.on("mustAutoSort", initBookmarkListener);
    simplePrefs.on("isButtonEnabled", initButtonAdvancedOptions);

    initButtonAdvancedOptions();
    initBookmarkListener();

    //At first run open advanced option so the can sort all bookmarks
    if (options.loadReason === "install") {
        openAdvancedOptions();
    }
}

/*
Called by firefox at addon unload time
"uninstall" reason will never be called because of bug:
https://bugzilla.mozilla.org/show_bug.cgi?id=627432
only when this bug will be fixed i'll be able to clean the advanced options
*/
function onUnload(reason) {
    console.log("Unloading SimpleSort bookmarks cause: " + reason);
    if (bmsvc !== undefined) {
        bmsvc.removeObserver(bookmarkListener);
    }
    if (reason === "uninstall") {
        storageHandler.deleteAllOptions();
    }
}

exports.main = main;
exports.onUnload = onUnload;
