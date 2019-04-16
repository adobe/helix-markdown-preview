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
const puppeteer = require('puppeteer');
const pti = require('puppeteer-to-istanbul');
const path = require('path');
const assert = require('assert');

const testUrlRaw = 'https://raw.githubusercontent.com/rofe/helix-markdown-preview/master/README.md';
const extensionPath = path.join(__dirname, '../../src');

const scripts = [
  fs.readFileSync(path.join(__dirname, '../../src/lib/marked.min.js'), 'utf-8').toString(),
  fs.readFileSync(path.join(__dirname, '../../src/lib/diffDOM.js'), 'utf-8').toString(),
  fs.readFileSync(path.join(__dirname, '../../src/HelixMarkdownPreview.js'), 'utf-8').toString(),
  fs.readFileSync(path.join(__dirname, '../../src/background.js'), 'utf-8').toString(),
];

let browser;
let testPage;
const allCoverage = [];

function cleanUp() {
  browser = null;
  testPage = null;
}

async function getBackgroundPage() {
  const targets = await browser.targets();
  const target = targets.find(({ _targetInfo }) => _targetInfo.type === 'background_page');
  const page = await target.page();
  return page;
}

describe('HelixMarkdownPreview integration test (WIP)', () => {
  beforeEach(async () => {
    browser = await puppeteer.launch({
      headless: false, // extensions can't be tested in headless mode
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--auto-open-devtools-for-tabs',
        '--error-console',
        '--enable-logging',
      ],
    });
    const extPage = await browser.newPage();
    extPage.goto('chrome://extensions');
    testPage = await browser.newPage();
    await Promise.all([
      testPage.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: true }),
    ]);
  });

  afterEach(async () => {
    allCoverage.concat(await Promise.all([
      testPage.coverage.stopJSCoverage(),
    ]));
    await browser.close();
    cleanUp();
  });

  after(() => {
    pti.write(allCoverage);
  });

  it.only('with raw markdown page', async () => {
    await testPage.goto(testUrlRaw, { waitUntil: 'networkidle2' });
    const bgp = await getBackgroundPage();
    scripts.forEach(async (script) => {
      await bgp.evaluate(script);
    });
    setTimeout(async () => {
      assert.equal(await bgp.evaluate('typeof window.HelixMarkdownPreview'), 'object');
      const currentTab = await testPage.evaluate('chrome.tabs.getCurrent(tab => return tab;});');
      // "click" page action for current tab
      await bgp.evaluate(`chrome.pageAction.onClicked.dispatch({id:${currentTab.id}});`);
    }, 2000);
    setTimeout(() => {
      // wait 2 seconds for done to be called, then fail
      assert.fail('This took longer than 5s.');
    }, 5000);
  });
});
