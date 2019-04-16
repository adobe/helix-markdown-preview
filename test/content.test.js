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

const testUrlRaw = 'https://raw.githubusercontent.com/rofe/helix-markdown-preview/master/README.md';

describe('content page (WIP)', () => {
  let window;
  const scripts = [
    new Script([fs.readFileSync(path.join(__dirname, '../src/HelixMarkdownPreview.js'), 'utf-8')]),
    new Script([fs.readFileSync(path.join(__dirname, '../src/content.js'), 'utf-8')]),
  ];

  let contentPage;

  beforeEach(async () => {
    contentPage = new JSDOM('<html></html>', {
      resources: 'usable',
      runScripts: 'dangerously',
      beforeParse(win) {
        window = win;
      },
    });
    contentPage.window.chrome = chrome;
  });

  afterEach(() => {
    chrome.reset();
    window.close();
  });

  it.skip('should attach listeners on startup', async () => {
    scripts.forEach((script) => {
      contentPage.runVMScript(script);
    });
    sinon.calledOnce(chrome.runtime.onMessage.addListener);
  });

  it.skip('should have a HelixMarkdownPreview object', () => {
    assert.isObject(window.HelixMarkdownPreview,
      'HelixMarkdownPreview is a object');
    assert.isFunction(window.HelixMarkdownPreview.getSender,
      'HelixMarkdownPreview has a getSender method');
  });

  it.skip('sends raw markdown', () => {
    // todo
  });
});
