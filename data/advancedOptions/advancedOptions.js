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

/* global self */

(function () {

/*
The script is loaded from the addons, not through a <scrit> tag. No need to
wait for the "onload" event.
*/

function byId(id) {
    return document.getElementById(id);
}

/*
array of objects sent by main.js containing all the bookmark folders with id,
title and childs
*/
var allFolders = [];
// Ids of the blacklisted folders. Used only locally, this is NOT sent do main.js
var blacklistedFolders = [];
//DOM elements
var divAllFolders = byId("divAllFolders");
var elBlacklistedFolders = byId("divBlacklistedFolders");
var elAvailableFolders = byId("elAvailableFolders");
var elDialogSortingMessageSorting = byId("dialogSortingMessageSorting");
var elDialogSortingMessageComplete = byId("dialogSortingMessageComplete");
var buttonCloseDialogSorting = byId("buttonCloseDialogSorting");
var dialogConfirmSortAll = byId("dialogConfirmSortAll");
var dialogSorting = byId("dialogSorting");
var elOverlay = byId("overlay");
var anchorBaseSettings = byId("anchorBaseSettings");

/*
Remove all childs of a node this way is better then using:
    targetNode.innerHTML = "";
for both security and performance reasons.
Advice from an AMO reviwer, for more info search "innerHTML vs removeChild".
 */
function removeAllChilds(targetNode) {
    while (targetNode.firstChild) {
        targetNode.removeChild(targetNode.firstChild);
    }
}

/*
Toggle the visibility of the passed element as popup dialog.
*/
function displayPopupElement(element, visible) {
    if (visible) {
        element.style.display = "block";
        elOverlay.style.display = "block";
    } else {
        element.style.display = "none";
        elOverlay.style.display = "none";
    }
}

/*
1. Add folderId to blacklistedFolders array
3. add a <li> to the blocklist <ul>
4. hide the addToBlacklist dialog
*/
function addFolderToBlacklist(folderId) {
    blacklistedFolders.push(folderId);

    var folderPath = findPathToFolder(folderId, allFolders);
    addFolderToElBlacklist(folderId, folderPath);
    self.port.emit("requestBookmarks");
    displayPopupElement(divAllFolders, false);
}

/*
Calculate the path to a blacklisted folder. This is used to populate the
blacklisted folder <ul> into the main page.

The calculate string is something like:

First parent / First child / Last child
*/
function findPathToFolder(folderId, folders) {
    var folder;
    for (var i = 0; i < folders.length; i++) {
        folder = folders[i];
        if (folder.id == folderId) {
            console.log("found folder id " + folderId);
            return folder.title;
        }
        if (folder.child !== null) {
            var childFolders = findPathToFolder(folderId, folder.child);
            if (childFolders !== undefined) {
                return folder.title + " / " + childFolders;
            }
        }
    }
}

/*
Callback function called when the user clicks on a folder in the dialog
to add a folder to the blacklist.
*/
function handleAvailableFolderClicked(event) {
    console.log("clicked folder with id: " + event.target.getAttribute("id"));
    var stringId = event.target.getAttribute("id");
    var id = parseInt(stringId, 10);
    if (blacklistedFolders.indexOf(id) === -1) {
        addFolderToBlacklist(id);
        self.port.emit("addToBlacklist", id);
    } else {
        console.log("duplicate folder");
    }
}

/*
Build a nested <ul> representing the bookmark folder structure.

folders is an array of object of like this:
{ string title,
  int id,
  object child }
Where child is of the same type of folders
- adds onClick event listener for selecting the folder to blacklist
- marks already blacklisted folders in gray and avoids to attach the event listener
*/
function listChilds(folders, alreadyBlacklisted) {
    var childsAlreadyBlacklisted;
    var ul, li, folder;
    ul = document.createElement('ul');
    for (var i = 0; i < folders.length; i++) {
        folder = folders[i];
        li = document.createElement('li');
        li.setAttribute("id", folder.id);
        li.appendChild(document.createTextNode(folder.title));
        if (alreadyBlacklisted ||
            (blacklistedFolders.indexOf(folder.id) !== -1)) {
            //Already blacklisted
            li.className = "alreadyBlacklisted";
            //Mark as blacklisted also the child folders
            if (folder.child !== null) {
                childsAlreadyBlacklisted = true;
            }
        } else {
            li.addEventListener('click', handleAvailableFolderClicked);
        }

        ul.appendChild(li);
        if (folder.child !== null) {
            ul.appendChild(listChilds(folder.child, childsAlreadyBlacklisted));
            childsAlreadyBlacklisted = false;
        }
    }
    return ul;
}

/*
Removes the folder from the blacklist
1. remove the id form the blaclistedFolders array
2. remove the <li> element from the web page
3. notify the action to main.js
*/
function removeFolderFromElBlacklist(event) {
    //Get folder id from item id attribute
    var stringId = event.target.getAttribute("id").replace("blacklisted", "");
    var id = parseInt(stringId, 10);
    console.log("clicked blacklisted folder with id: " + id);
    /* Remove folderId from blaclistedFolders array */
    var newBlacklist = [];
    for (var i = 0; i < blacklistedFolders.length; i++) {
        if (blacklistedFolders[i] != id) {
            newBlacklist.push(blacklistedFolders[i]);
        }
    }
    blacklistedFolders = newBlacklist;
    //remove the <li> from the <ul>
    var targetList = event.target.parentNode;
    targetList.parentNode.removeChild(targetList);
    //check if this was the last one
    if (blacklistedFolders.length === 0) {
        displayEmptyListMessage();
    }
    //tell main.js about the change
    self.port.emit("removeToBlacklist", id);
}

/*
Adds the folder with id folderId with title folderTitle to the blacklist
1. create a <li> element with the onClick event listener on the "remove" tutton
2. add the <li> to the <ul>
3. add the id of the folder to the blacklisteFolders array
*/
function addFolderToElBlacklist(folderId, folderTitle) {
    var li = document.createElement('li');
    var button = document.createElement('button');
    var elPath = document.createElement('span');
    button.setAttribute("id", "blacklisted" + folderId);
    button.title = "Remove from blacklist";
    button.addEventListener('click', removeFolderFromElBlacklist);
    li.appendChild(button);

    elPath.appendChild(document.createTextNode(folderTitle));

    li.appendChild(elPath);

    if (blacklistedFolders.length === 1) {
        removeAllChilds(elBlacklistedFolders);
    }
    elBlacklistedFolders.appendChild(li);

    blacklistedFolders.push(folderId);
}

/*
When the <ul> of the blacklisted folders is emtpy this function will be
called to write "The list is empty" in gray.
*/
function displayEmptyListMessage() {
    var emptyMessage;
    var emptyText;
    emptyMessage = document.createElement("span");
    emptyText = document.createTextNode("The list is empty"),
    emptyMessage.appendChild(emptyText);
    emptyMessage.style.color = "gray";
    elBlacklistedFolders.appendChild(emptyMessage);
}

/*
Populate the blacklist with the data received from main.js
*/
function populateBlacklist(data) {
    var folder;
    if (data.length === 0) {
        displayEmptyListMessage();
    } else {
        for (var i = 0; i < data.length; i++) {
            addFolderToBlacklist(data[i]);
        }
    }
}


byId("buttonShowConfirmSortAll").addEventListener("click", function (event) {
    displayPopupElement(dialogConfirmSortAll, true);
});

byId("buttonHideDialogConfirmSortAll").addEventListener("click", function (event) {
    displayPopupElement(dialogConfirmSortAll, false);
});

byId("buttonAddToBlacklist").addEventListener("click", function (event) {
    self.port.emit("requestBookmarks");
    displayPopupElement(divAllFolders, true);
});

byId("elHideDialogAddToBlacklist").addEventListener("click", function (event) {
    displayPopupElement(divAllFolders, false);
});

byId("buttonSortAll").addEventListener('click', function (event) {
    self.port.emit("sortAllBookmarks");
    displayPopupElement(dialogConfirmSortAll, false);
});

byId("buttonBackup").addEventListener('click', function (event) {
    self.port.emit("backup");
});

byId("buttonBackupInDialog").addEventListener('click', function (event) {
    self.port.emit("backup");
});

byId("buttonClose").addEventListener('click', function (event) {
    self.port.removeListener("sortStarted", sortStartedCallback);
    self.port.emit("close");
});

buttonCloseDialogSorting.addEventListener("click", function (event) {
    displayPopupElement(dialogSorting, false);
});

anchorBaseSettings.addEventListener("click", function(event) {
    self.port.emit("openBaseSettings");
});

self.port.on("loadBookmarks", function (data) {
    allFolders = data.bookmarks;
    var ul = listChilds(allFolders);
    removeAllChilds(elAvailableFolders);
    elAvailableFolders.appendChild(ul);
});

self.port.on("loadBlacklist", function (data) {
    populateBlacklist(data);
});

self.port.on("sortStarted", sortStartedCallback);

function sortStartedCallback() {
    displayPopupElement(dialogSorting, true);
    elDialogSortingMessageSorting.style.display = "block";
    elDialogSortingMessageComplete.style.display = "none";
}

self.port.on("sortCompleted", function () {
    elDialogSortingMessageSorting.style.display = "none";
    elDialogSortingMessageComplete.style.display = "block";
});

self.port.emit("requestInitData");

}());
