/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
/* eslint-env mocha */

'use strict';

const fs = require('fs-extra');
const path = require('path');
const sinon = require('sinon').assert;
const chrome = require('sinon-chrome/extensions');
const { assert } = require('chai');
const { JSDOM } = require('jsdom');
const { Script } = require('vm');
const { PageActionTester } = require('./utils');

const testUrlRaw = 'https://raw.githubusercontent.com/rofe/helix-markdown-preview/master/README.md';

describe('background page (WIP)', () => {
  let window;
  const scripts = [
    new Script([fs.readFileSync(path.join(__dirname, '../src/lib/marked.min.js'), 'utf-8')]),
    new Script([fs.readFileSync(path.join(__dirname, '../src/lib/diffDOM.js'), 'utf-8')]),
    new Script([fs.readFileSync(path.join(__dirname, '../src/HelixMarkdownPreview.js'), 'utf-8')]),
    new Script([fs.readFileSync(path.join(__dirname, '../src/background.js'), 'utf-8')]),
  ];

  beforeEach(() => {
    const bgPage = new JSDOM('<html></html>', {
      resources: 'usable',
      runScripts: 'dangerously',
      beforeParse(win) {
        window = win;
      },
    });
    bgPage.window.chrome = chrome;
    scripts.forEach(script => bgPage.runVMScript(script));
  });

  afterEach(() => {
    chrome.reset();
    window.close();
  });

  it('should attach listeners on startup', () => {
    sinon.calledOnce(chrome.runtime.onInstalled.addListener);
    sinon.calledOnce(chrome.pageAction.onClicked.addListener);
  });

  it('should have a HelixMarkdownPreview object', () => {
    assert.isObject(window.HelixMarkdownPreview,
      'HelixMarkdownPreview is a object');
    assert.isFunction(window.HelixMarkdownPreview.getReceiver,
      'HelixMarkdownPreview has a getReceiver method');
  });

  it.skip('enables page action for raw markdown', async (done) => {
    const observer = new PageActionTester(testUrlRaw, done);
    setTimeout(() => {
      // fail if done isn't called inside observer
      observer.abort(new Error('This is taking longer than 2s.'));
    }, 2000);
  });
});
