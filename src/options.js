/*
 * Copyright 2018 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

'use strict';

function getStorageKey(id) {
	var cut = id.indexOf("Input");
	if (cut > 0) {
		return id.substring(0, cut);
	}
	return null;
}

function setStatus(key, msg, cls) {
	var status = document.getElementById(key + "Status");
	if (!status) {
		return;
	}
	status.textContent = msg;
	status.className = cls;
	status.style.display = msg ? "visible" : "hidden";
	if (msg) {
		// hide status message after 2s
		setTimeout(function() {
			setStatus(key, "", "");
		}, 2000);
	}
}

// Saves option to chrome.storage
function saveOption(evt) {
	var elem = evt.target;
	var key = getStorageKey(elem.id);
	var obj = {};
	obj[key] = elem.value;
	chrome.storage.sync.set(obj, function() {
		// Update status to let user know option was saved.
		var msg = "Saved";
		var cls = "success";
		if (chrome.runtime.lastError) {
			msg = "Error: "+chrome.runtime.lastError;
			cls = "error";
		}
		setStatus(key, msg, cls);
	});
}

function urlFiltersButtonAction() {
	alert("TODO: save URL Filters");
}

function resetButtonAction() {
	if (confirm("Are you sure you want to erase all custom settings?")) {
		chrome.storage.sync.clear(function() {
			if (!chrome.runtime.lastError) {
				alert("Options successfully reset");
				window.location.reload();
			} else {
				alert("Options not reset: " + chrome.runtime.lastError);
			}
		});
	}
}

// Populate form using the preferences stored in chrome.storage.
function populateOptions() {
	var i = 0;
	var keys = [];
	var fields = [];
	var forms = document.getElementsByTagName("form");
	for (i=0; i < forms.length; i++) {
		var elem = forms[i].elements[0];
		if (elem.tagName.toLowerCase() != "input" && 
			elem.tagName.toLowerCase() != "select") {
			continue;
		}
		var key = getStorageKey(elem.id);
		if (key) {
			keys.push(key);
			fields.push(elem);
		}
	}
	// get values from chrome storage
	chrome.storage.sync.get(keys, function(res){
		//console.log("custom settings", res);
		for (i=0; i < keys.length; i++) {
			var key = keys[i];
			fields[i].value = res[key] ? res[key] : "";
		}
	});
	
	// add change listeners to form fields
	for (i=0; i < fields.length; i++) {
		fields[i].addEventListener("change", saveOption);
	}
	// add click listeners to buttons 
	var buttons = document.getElementsByTagName("button");
	for (i=0; i < buttons.length; i++) {
		var button = buttons[i];
		button.addEventListener("click", window[button.id + "Action"]);
	}
}

document.addEventListener('DOMContentLoaded', populateOptions);
