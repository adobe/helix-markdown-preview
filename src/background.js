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

// sanity check
if (typeof Helix == "undefined" || typeof Helix.MarkdownPreview == "undefined") {
	throw new Error("Helix.MarkdownPreview is undefined, load hlx_md_preview.js first");
}
// set shorthand
var hmdp = Helix.MarkdownPreview;

// upon installation, define where the extension should be active
chrome.runtime.onInstalled.addListener(function(details) {
	// TODO: use rules from configuration
	chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
		chrome.declarativeContent.onPageChanged.addRules([{
			conditions: [
				new chrome.declarativeContent.PageStateMatcher({
					pageUrl: {
						hostSuffix: "github.com",
						pathContains: "/edit/",
						pathSuffix: ".md"
					}
				}),
				new chrome.declarativeContent.PageStateMatcher({
					pageUrl: {
						hostEquals: "raw.githubusercontent.com",
						pathSuffix: ".md"
					}
				})
			],
			actions: [new chrome.declarativeContent.ShowPageAction()]
		}]);
	});
	console.log("Extension installed");
});

// when the page action is clicked, initiate markdown preview
chrome.pageAction.onClicked.addListener(function(tab) {
	console.log("Action triggered on", tab.url);
	if (hmdp.isReceiverStarted()) {
		hmdp.stopReceiver();
	} else {
		hmdp.startReceiver(tab.id, function() {
			// load content scripts inside the tab
			chrome.tabs.executeScript(tab.id, {
				"file": "hlx_md_preview.js"
			}, function() {
				chrome.tabs.executeScript(tab.id, {
					"file": "content.js"
				}, function() {
					// start polling
					hmdp.startPoll(function() {
						console.log("Requesting markdown from", tab.id);
						chrome.tabs.sendMessage(tab.id, {"id": hmdp.ID, "tabId":tab.id}, hmdp.process);
					});
				});
			});
		});
	}
});
