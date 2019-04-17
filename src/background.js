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
if (typeof HelixMarkdownPreview === 'undefined') {
  throw new Error('HelixMarkdownPreview is undefined');
}

// check if the provided tab is allowed to use this extension
// TODO: make configurable?
function checkTab(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (tab && tab.url) {
      // enable extension if raw markdown
      if (tab.url.match(/^https:\/\/raw\.githubusercontent\.com\/.*\.md$/)) {
        chrome.browserAction.enable(tab.id);
        return;
      }
      // enable extension if markdown editor
      if (tab.url.match(/^https:\/\/.*github\.com\/.*\/edit\/.*\.md$/)) {
        chrome.browserAction.enable(tab.id);
        return;
      }
      // provide badge with hint if blob view
      if (tab.url.match(/^https:\/\/.*github\.com\/.*\/blob\/.*\.md$/)) {
        chrome.browserAction.setBadgeText({ text: '?', tabId });
        chrome.browserAction.setBadgeBackgroundColor({ color: '#c3003c', tabId });
        chrome.browserAction.setTitle({ title: 'Start editing to enable markdown preview', tabId });
      }
    }
    chrome.browserAction.disable(tabId);
  });
}

// listen for tab changes on check eligibility
chrome.tabs.onActivated.addListener(({ tabId }) => {
  checkTab(tabId);
});
chrome.tabs.onUpdated.addListener((tabId) => {
  checkTab(tabId);
});

// when the browser action is clicked, toggle the markdown preview
chrome.browserAction.onClicked.addListener((tab) => {
  HelixMarkdownPreview.getReceiver((receiver) => {
    // load scripts inside the content tab
    chrome.tabs.executeScript(tab.id, {
      file: 'HelixMarkdownPreview.js',
    }, () => {
      chrome.tabs.executeScript(tab.id, {
        file: 'content.js',
      }, () => {
        // prep receiver
        if (receiver.isRunning()) {
          receiver.stop();
        } else {
          receiver.start(tab);
        }
      });
    });
  });
});
