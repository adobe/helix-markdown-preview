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
const { assert } = require('chai');

const testUrlRaw = 'https://raw.githubusercontent.com/rofe/helix-markdown-preview/master/README.md';
const extensionPath = path.join(__dirname, '../../src');
const allCoverage = [];
const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, '/manifest.json')));
const contentScripts = [
  fs.readFileSync(path.join(extensionPath, '/HelixMarkdownPreview.js'), 'utf-8').toString(),
  fs.readFileSync(path.join(extensionPath, '/content.js'), 'utf-8').toString(),
];

let browser;
let testPage;
let bgPage;

function cleanUp() {
  browser = null;
  testPage = null;
  bgPage = null;
}

async function getBackgroundPage() {
  const targets = await browser.targets();
  const target = targets.find(({ _targetInfo }) => _targetInfo.title === manifest.name
    && _targetInfo.type === 'background_page');
  const page = await target.page();
  return page;
}

describe('HelixMarkdownPreview integration test (WIP)', () => {
  beforeEach(async () => {
    browser = await puppeteer.launch({
      // slowMo: 100,
      devtools: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    const extPage = await browser.newPage();
    await extPage.goto('chrome://extensions');
    testPage = await browser.newPage();
    await Promise.all([
      testPage.coverage.startJSCoverage({
        resetOnNavigation: false,
        reportAnonymousScripts: true,
      }),
    ]);
    bgPage = await getBackgroundPage();
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
    const t = setTimeout(() => {
      // fail the test if it is taking too long
      assert.fail('This took longer than 30s.');
    }, 30000);
    await testPage.goto(testUrlRaw, { waitUntil: 'networkidle2' });
    assert.equal(await bgPage.evaluate('typeof HelixMarkdownPreview'), 'object', 'background page is supposed to have a HelixMarkdownPreview object');
    contentScripts.forEach(async (script) => {
      await testPage.evaluateHandle(script);
    });
    await bgPage.evaluate('HelixMarkdownPreview.getReceiver(receiver => receiver.start())');
    assert.equal(await testPage.evaluate('typeof HelixMarkdownPreview'), 'object', 'content page is supposed to have a HelixMarkdownPreview object');
    clearTimeout(t);
  });
});
