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

// upon installation, define where the extension should be active
chrome.runtime.onInstalled.addListener(() => {
  // TODO: use rules from configuration
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {
            hostSuffix: 'github.com',
            pathContains: '/edit/',
            pathSuffix: '.md',
          },
        }),
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {
            hostEquals: 'raw.githubusercontent.com',
            pathSuffix: '.md',
          },
        }),
      ],
      actions: [new chrome.declarativeContent.ShowPageAction()],
    }]);
  });
  console.log('Extension installed');
});

// when the page action is clicked, initiate markdown preview
chrome.pageAction.onClicked.addListener((tab) => {
  /* eslint-disable no-console */
  console.log('Action triggered on', tab.url);

  HelixMarkdownPreview.getInstance(window, (hmdp) => {

    hmdp.startReceiver(tab);
    // load scripts inside the content tab
    chrome.tabs.executeScript(tab.id, {
      file: 'HelixMarkdownPreview.js',
    }, () => {
      chrome.tabs.executeScript(tab.id, {
        file: 'content.js',
      }, () => {
        hmdp.startSender(() => {
          console.log('Requesting markdown from', tab.id);
          chrome.tabs.sendMessage(tab.id, { id: hmdp.ID, tabId: tab.id },
            hmdp.process);
        });
      });
    });
  });
  /* eslint-enable no-console */
});
