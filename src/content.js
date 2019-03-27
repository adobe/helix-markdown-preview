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
  throw new Error('HelixMarkdownPreview is undefined, load hlx_md_preview.js first');
}

HelixMarkdownPreview.getInstance(window, (hmdp) => {
  // start listening for messages
  chrome.runtime.onMessage.addListener((msg, ...args) => {
    if (msg.id === hmdp.ID && args.length > 1) {
      // eslint-disable-next-line no-console
      console.log('sending markdown from', msg.tabId);
      const sendResponse = args[1];
      sendResponse(hmdp.assemble(msg.tabId));
    }
  });
});
