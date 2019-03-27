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

/* eslint-disable no-unused-vars, no-alert, no-restricted-globals */

function getStorageKey(id) {
  const cut = id.indexOf('Input');
  if (cut > 0) {
    return id.substring(0, cut);
  }
  return null;
}

function setStatus(key, msg, cls) {
  const status = document.getElementById(`${key}Status`);
  if (!status) {
    return;
  }
  status.textContent = msg;
  status.className = cls;
  status.style.display = msg ? 'visible' : 'hidden';
  if (msg && cls !== 'error') {
    // hide status message after 2s
    setTimeout(() => {
      setStatus(key, '', '');
    }, 4000);
  }
}

// Saves option to chrome.storage
function saveOption(e) {
  const elem = e.target;
  const key = getStorageKey(elem.id);
  if (e.error) {
    chrome.storage.sync.get([key], (res) => {
      elem.value = res[key] || '';
    });
    return;
  }
  const obj = {};
  const value = elem.type === 'checkbox' ? elem.checked : elem.value;
  obj[key] = value;
  chrome.storage.sync.set(obj, () => {
    // Update status to let user know option was saved.
    let msg = 'Saved';
    let cls = 'success';
    if (chrome.runtime.lastError) {
      msg = `Error: ${chrome.runtime.lastError}`;
      cls = 'error';
    }
    setStatus(key, msg, cls);
  });
}

function urlFiltersButtonAction() {
  alert('TODO: save URL Filters');
}

function resetButtonAction() {
  if (confirm('Are you sure you want to erase all custom settings?')) {
    chrome.storage.sync.clear(() => {
      if (!chrome.runtime.lastError) {
        alert('Options successfully reset');
        window.location.reload();
      } else {
        alert(`Options not reset: ${chrome.runtime.lastError}`);
      }
    });
  }
}

function popupWidthAction(e) {
  const minWidth = document.getElementById('popupMinWidthInput').value;
  const evt = e;
  const elem = e.target;
  const width = elem.value;
  if (width && minWidth && width < minWidth) {
    evt.error = 'Error: width must be larger than minimum width';
    setStatus(getStorageKey(elem.id), evt.error, 'error');
    return false;
  }
  return true;
}

function popupMinWidthAction(e) {
  const width = document.getElementById('popupWidthInput').value;
  const evt = e;
  const elem = e.target;
  const minWidth = elem.value;
  if (width && minWidth && elem.value > width) {
    evt.error = 'Error: minimum width must be smaller than width';
    setStatus(getStorageKey(elem.id), evt.error, 'error');
    return false;
  }
  return true;
}

function toggleElements(elements, show) {
  elements.forEach((elem, id) => {
    if (id === 0) return; // skip first one
    const { style } = elem;
    style.display = show ? 'block' : 'none';
  });
}

// Populate form using the preferences stored in chrome.storage.
function populateOptions() {
  const keys = [];
  const fields = [];
  const inputs = document.getElementsByTagName('input');
  let i;
  for (i = 0; i < inputs.length; i += 1) {
    const elem = inputs[i];
    const key = getStorageKey(elem.id);
    if (key) {
      keys.push(key);
      fields.push(elem);
    }
  }
  // get values from chrome storage
  chrome.storage.sync.get(keys, (res) => {
    keys.forEach((key, num) => {
      if (fields[num].type === 'checkbox') {
        fields[num].checked = res[key];
      }
      fields[num].value = res[key] ? res[key] : '';
    });
  });
  // add change listeners to form fields
  fields.forEach((field) => {
    const key = getStorageKey(field.id);
    if (window[`${key}Action`] && typeof window[`${key}Action`] === 'function') {
      field.addEventListener('change', window[`${key}Action`]);
    }
    field.addEventListener('change', saveOption);
  });
  // add click listeners to buttons
  const buttons = document.getElementsByTagName('button');
  for (i = 0; i < buttons.length; i += 1) {
    buttons[i].addEventListener('click', window[`${buttons[i].id}Action`]);
  }
  // gather helix fields and sections
  const helixFields = fields.filter(elem => elem.id.startsWith('helix'));
  const helixSections = [];
  helixFields.forEach((field) => {
    helixSections.push(document.getElementById(getStorageKey(field.id)));
  });
  // toggle helix sections based on helix checkbox value
  setTimeout(() => {
    toggleElements(helixSections, helixFields[0].checked);
  }, 100);
  // add change listener to helix checkbox
  helixFields[0].addEventListener('change', (evt) => {
    toggleElements(helixSections, evt.target.checked);
    // helixFields.forEach(function(field) {
    // field.disabled = !this.checked;
    // });
  });
}

document.addEventListener('DOMContentLoaded', populateOptions);
