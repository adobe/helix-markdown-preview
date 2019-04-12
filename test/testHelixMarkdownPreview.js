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

global.chrome = require('sinon-chrome');
const { MockBrowser } = require('mock-browser').mocks;
const assert = require('assert');

beforeEach(() => {
  /* eslint-disable global-require */
  global.window = MockBrowser.createWindow();
  global.diffDOM = require('../src/lib/diffDOM');
  global.marked = require('../src/lib/marked.min');
  global.HelixMarkdownPreview = require('../src/HelixMarkdownPreview');
  /* eslint-enable global-require */
});

afterEach(() => {
  delete global.HelixMarkdownPreview;
  delete global.marked;
  delete global.diffDOM;
  delete global.window;
});

describe('HelixMarkdownPreview - unit tests', () => {
  it.only('is a global object with static functions', () => {
    assert.equal(typeof HelixMarkdownPreview, 'object');
    assert.equal(typeof HelixMarkdownPreview.getReceiver, 'function');
    assert.equal(typeof HelixMarkdownPreview.getSender, 'function');
  });

  it.only('starts and stops sender', () => {
    HelixMarkdownPreview.getSender((sender) => {
      sender.start();
      assert.ok(sender.isRunning());
      sender.stop();
    });
  });

  it.only('starts and stops receiver', () => {
    HelixMarkdownPreview.getReceiver((receiver) => {
      const tab = { id: 123, width: 1024 };
      receiver.start(tab);
      assert.ok(receiver.isRunning());
      assert.deepEqual(chrome.runtime.HelixMarkdownPreview_tab1, tab);
      receiver.stop();
    });
  });

  it('sender and receiver communicate', () => {
    window.location.href = 'https://raw.githubusercontent.com/rofe/helix-markdown-preview/master/README.md';
    const sender = HelixMarkdownPreview.getSender();
    setTimeout(() => {
      sender.start();
      assert.ok(sender.isRunning());
      sender.stop();
    }, 1000);

    const receiver = HelixMarkdownPreview.getReceiver();
    setTimeout(() => {
      const tab = { id: 123, width: 1024 };
      receiver.start(tab);
      assert.ok(receiver.isRunning());
      receiver.stop();
    }, 1000);
  });
});
