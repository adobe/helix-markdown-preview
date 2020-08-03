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
const sinon = require('sinon');
const chrome = require('sinon-chrome/extensions');
const { assert } = require('chai');
const { JSDOM } = require('jsdom');
const { Script } = require('vm');

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
    scripts.forEach((script) => bgPage.runVMScript(script));
  });

  afterEach(() => {
    chrome.reset();
    window.close();
  });

  it('attaches listeners on startup', () => {
    sinon.assert.calledOnce(chrome.tabs.onActivated.addListener);
    sinon.assert.calledOnce(chrome.tabs.onUpdated.addListener);
    sinon.assert.calledOnce(chrome.browserAction.onClicked.addListener);
  });

  it('has a HelixMarkdownPreview object', () => {
    assert.isObject(window.HelixMarkdownPreview,
      'HelixMarkdownPreview is a object');
    assert.isFunction(window.HelixMarkdownPreview.getReceiver,
      'HelixMarkdownPreview has a getReceiver method');
    assert.isFunction(window.checkTab,
      'checkTab is a function');
  });

  // TODO: callback never called -> evergreen test
  it('keeps browser action disabled if non-markdown URL', () => {
    const spy = sinon.spy(window.checkTab);
    chrome.tabs.onCreated.trigger({
      id: 1234,
      url: 'https://github.com/rofe/helix-markdown-preview',
    }, (tab) => {
      sinon.assert.called(spy);
      sinon.assert.calledWith(chrome.browserAction.disable, { id: tab.id });
      sinon.assert.neverCalled(chrome.browserAction.enable);
    });
  });

  // TODO: callback never called -> evergreen test
  it('keeps browser action disabled and shows tooltip if github markdown (blob view)', () => {
    chrome.tabs.onCreated.trigger({
      id: 1234,
      url: 'https://github.com/rofe/helix-markdown-preview/blob/main/README.md',
    }, (tab) => {
      sinon.assert.calledOnce(chrome.browserAction.show);
      sinon.assert.calledWith(chrome.browserAction.disable, { id: tab.id });
      sinon.assert.neverCalled(chrome.browserAction.enable);
    });
  });

  // TODO: callback never called -> evergreen test
  it('enables browser action if github markdown (edit view)', () => {
    chrome.tabs.onCreated.trigger({
      url: 'https://github.com/rofe/helix-markdown-preview/edit/main/README.md',
    }, (tab) => {
      sinon.assert.calledWith(chrome.browserAction.enable, { id: tab.id });
      sinon.assert.neverCalledWith(chrome.browserAction.disable, { id: tab.id });
    });
  });

  // TODO: callback never called -> evergreen test
  it('enables browser action if raw github markdown file', () => {
    chrome.tabs.onCreated.trigger({
      url: 'https://raw.githubusercontent.com/rofe/helix-markdown-preview/main/README.md',
    }, (tab) => {
      sinon.assert.calledWith(chrome.browserAction.enable, { id: tab.id });
      sinon.assert.neverCalledWith(chrome.browserAction.disable, { id: tab.id });
    });
  });
});
