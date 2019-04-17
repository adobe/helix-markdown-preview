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
const chrome = require('sinon-chrome/extensions');
const { assert } = require('chai');

/**
 * Test the extension's page action
 */
class PageActionTester {
  _next(tab) {
    if (this._assertStack.length > 0) {
      // call next function in stack
      this._assertStack.shift()(tab);
    } else if (this._callback) {
      // done
      this._callback();
    }
  }

  _assertPageAction(tab) {
    // "click" pageAction to trigger extension
    chrome.pageAction.onClicked.dispatch(tab);
    chrome.pageAction.show(tab.id, () => {
      // check if popup is shown
      chrome.extension.getViews({ type: 'popup' }, (views) => {
        assert.isAtLeast(views.length, 1, 'popup expected');
      });
      this._next(tab);
    });
  }

  _assertReceiver(tab) {
    // check if receiver is on
    window.HelixMarkdownPreview.getReceiver((receiver) => {
      assert.isTrue(receiver.isRunning());
      this._next(tab);
    });
  }

  _assertPopup(tab) {
    chrome.pageAction.getPopup({ tabId: tab.id }, (res) => {
      // check popup HTML
      assert.equal(res, fs.readFileSync(path.join(__dirname, '../src/popup.html')));
      this._next(tab);
    });
  }

  /**
   * Creates a new PageActionTester.
   * @param {string} url The URL to "navigate" to
   * @param {function} callback The done function
   */
  constructor(url, callback) {
    this._url = url;
    this._assertStack = [
      this._assertPageAction,
      this._assertReceiver,
      this._assertPopup,
    ];
    this._callback = callback;
    this._activeTab = null;
    chrome.tabs.onUpdated.addListener(tab => this.handleEvent(tab));
    chrome.tabs.onUpdated.dispatch({ url: this._url, id: 1 });
  }

  handleEvent(tab) {
    this._activeTab = tab;
    try {
      this._next(tab);
    } catch (e) {
      if (this._callback) {
        this._callback(e);
      } else {
        assert.fail(e);
      }
    }
  }

  abort(e) {
    const error = e || new Error('Abort');
    this._activeTab = null;
    this._url = null;
    chrome.tabs.onUpdated.removeListeners();
    if (this._callback) {
      this._callback(error);
    } else {
      assert.fail(error);
    }
  }
}

module.exports = {
  PageActionTester,
};
