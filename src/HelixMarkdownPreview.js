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

'use strict';

// sanity check
if (typeof window.HelixMarkdownPreview === 'undefined') {
  /**
   * HelixMarkdownPreview allows to request and process markdown from a given source.
   */
  /* eslint-disable-next-line no-unused-vars, func-names */
  window.HelixMarkdownPreview = (function () {
    const ID = 'HelixMarkdownPreview';
    let instance;
    let context;
    let cb;
    let activePoll = 0;
    let textArea;
    let popup;
    let previewWin;
    // let previewInitialized = false;
    // let diff;
    let config;

    /**
     * Initializes the <code>HelixMarkdownPreview</code> instance.
     * @param {window} win The window to use (optional, defaults to <code>window</code>)
     * @param {function} callback The function to call when done (optional)
     */
    function init(win, callback) {
      context = win || window;
      cb = callback;

      // extension-side methods

      /**
       * Enables zooming in the preview window.
       * @return {class} this
       */
      function enableZoom() {
        if (!popup || !previewWin) return;

        function calcZoom() {
          const zoom = Math.min(Math.max(Number(1 * popup.innerWidth / 1000).toFixed(1), 0.5), 1);
          return zoom;
        }

        const zoomCtl = popup.document.getElementById(`${ID}_zoom`);
        const zoom = config.popupZoom || calcZoom();
        previewWin.document.body.style.zoom = zoom;
        zoomCtl.value = zoom;

        // add zoom-related listeners
        zoomCtl.listeners = [{
          name: 'change',
          func: (e) => {
            // update zoom based on selected value
            previewWin.document.body.style.zoom = e.target.value;
          },
        }];
        zoomCtl.listeners.forEach((l) => {
          zoomCtl.addEventListener(l.name, l.func);
        });

        popup.listeners = [{
          name: 'resize',
          func: () => {
            // check if zoom needs to be recalculated based on popup width
            if (!config.popupZoom) {
              const newZoom = calcZoom();
              zoomCtl.value = newZoom;
              previewWin.document.body.style.zoom = newZoom;
            }
          },
        }];
        popup.listeners.forEach((l) => {
          popup.addEventListener(l.name, l.func);
        });
      }

      /**
       * Disables zooming in the preview window.
       * @return {class} this
       */
      function disableZoom() {
        if (!popup) return this;
        const zoomCtl = popup.document.getElementById(`${ID}_zoom`);
        zoomCtl.disabled = true;
        // remove zoom-related listeners
        while (zoomCtl.listeners && zoomCtl.listeners.length > 0) {
          const l = zoomCtl.listeners.shift();
          zoomCtl.removeEventListener(l.name, l.func);
        }
        while (popup.listeners && popup.listeners.length > 0) {
          const l = popup.listeners.shift();
          popup.removeEventListener(l.name, l.func);
        }
        return this;
      }

      /**
       * Stops the interval for sending markdown to the receiver.
       * @return {class} this
       */
      function stopSender() {
        if (activePoll) {
          context.clearInterval(activePoll);
          activePoll = 0;
        }
        return this;
      }

      /**
       * Removes the preview window and resets the extension.
       * @return {class} this
       */
      function removePopup() {
        if (popup) {
          popup.close();
        }
        popup = null;
        previewWin = null;
        return stopSender();
      }

      /**
       * Creates a new popup window for the markdown preview.
       * @param {object} tab The browser tab
       * @return {class} this
       */
      function createPopup(tab) {
        const t = 0; // TODO: get actual y offset
        let w = config.popupWidth || context.screen.width - tab.width;
        if (w < config.popupMinWidth) w = config.popupMinWidth;
        const h = context.screen.height;
        const l = (config.popupPosition === 'left') ? 0 : context.screen.width - w;
        popup = context.open('popup.html', ID, `width=${w},height=${h},top=${t},left=${l}`);
        // TODO: add close listener to parent window and close popup if tab is closed
        function prepPreviewWin() {
          previewWin = popup.document.getElementById(`${ID}_iframe`).contentWindow;
          // set initial content
          previewWin.document.getElementById(ID).innerHTML = '<p>Initializing...</p>'; // TODO: i18n
          popup.addEventListener('unload', () => removePopup());
          popup.removeEventListener('load', prepPreviewWin);
          // remove this listener again
          enableZoom();
        }
        popup.addEventListener('load', prepPreviewWin);
        return this;
      }

      /**
       * Returns the Helix URL if path is a markdown file and Helix is configured to be used.
       * @param {string} path The path of the markdown file
       * @return {string} The Helix URL or an empty <code>string</code>
       */
      function getHelixUrl(path) {
        if (!config.helixRendering || !config.helixBaseUrl || !path
          || !path.toLowerCase().endsWith('.md')) {
          return '';
        }
        let url = config.helixBaseUrl;
        url += path.replace(/\.md/i, '.html');
        url += `?hlx_cK=${Date.now()}`;
        return url;
      }

      // content-side methods

      /**
       * Checks if the markdown file is static (raw).
       * @return {boolean} <code>true</code> if markdown file is static, else <code>false</code>
       */
      function isStatic() {
        return context.location.hostname.startsWith('raw.');
      }

      /**
       * Retrieves the base URL for relative paths from the current context.
       * @return {string} The base URL
       */
      function getBaseUrl() {
        let url = context.location.href;
        url = url.substring(0, url.lastIndexOf('/') + 1);
        url = url.replace(/\/edit\//, '/raw/');
        return url;
      }

      /**
       * Retrieves the path from the current context.
       * @return {string} The path
       */
      function getPath() {
        let path = context.location.pathname;
        const branchCut = path.indexOf(`/${config.gitBranch}/`);
        if (branchCut > 0) {
          path = path.substring(branchCut + config.gitBranch.length + 1);
        }
        return path;
      }

      /**
       * Retrieves the markdown from the document.
       * @return {string} The markdown
       */
      function getMarkdown() {
        if (isStatic()) {
          // Get raw markdown
          try {
            return context.document.body.innerText;
          } catch (e) {
            // console.log('Error while retrieving raw markdown', e);
          }
        } else {
          // Get markdown from DOM
          if (!textArea) {
            const textAreas = context.document.getElementsByTagName('textarea');
            for (let i = 0; i < textAreas.length; i += 1) {
              const input = textAreas[i];
              if (input.name === 'value') {
                textArea = input;
                break;
              }
            }
          }
          if (textArea) {
            // github is in edit mode
            // retrieve markdown from textarea
            try {
              return textArea.value ? textArea.value : '\n';
            } catch (e) {
              // console.log('Error while retrieving markdown from DOM', e);
            }
          } else {
            // console.log('No markdown found');
          }
        }
        return '\n';
      }

      // load default config and overrides from storage
      chrome.storage.sync.get(null, (customConfig) => {
        config = Object.assign({
          urlFilters: [{
            hostSuffix: 'github.com',
            pathContains: '/edit/',
            pathSuffix: '.md',
          }, {
            hostEquals: 'raw.githubusercontent.com',
            pathSuffix: '.md',
          }],
          gitBranch: 'master',
          helixRendering: false,
          helixBaseUrl: null,
          pollInterval: 1000,
          popupMinWidth: 500,
          popupPosition: 'right',
          popupZoom: 0,
        },
        customConfig);
        // console.log('config', config);

        // public API
        const ret = {
          /**
           * The common ID used to identify windows and elements related to this extension.
           * @return {string} The ID
           */
          get ID() {
            return ID;
          },

          /**
           * Starts the receiver for markdown preview of the current tab.
           * @param {object} tab The browser tab
           * @return {class} this
           */
          startReceiver(tab) {
            removePopup(); // make sure there is no previous popup around
            createPopup(tab);
            return this;
          },

          /**
           * Checks if the receiver for markdown preview is active.
           * @return boolean <code>true</code> if receiver is active, else <code>false</code>
           */
          isReceiverStarted() {
            return (popup !== null);
          },

          /**
           * Starts an interval for sending markdown to the receiver.
           * @param {function} func The function to execute while polling
           * @return {number} The ID of the interval
           */
          startSender(func) {
            activePoll = context.setInterval(func, config.pollInterval);
            return activePoll;
          },

          /**
           * Assembles the data from the document for #process to consume.
           * @param {number} tabId the ID of the current tab.
           * @return {object} The data object:<ul>
           * <li>string markdown The markdown</li>
           * <li>number tabId The ID of the responding tab</li>
           * <li>string baseUrl The URL prefix for relative paths (optional)</li>
           * <li>string path The path of the markdown file being displayed</li>
           * <li>boolean static <code>true</code> if the page in the tab is static,
           *     else <code>false</code> (optional)</li></ul>
           */
          assemble(tabId) {
            return {
              markdown: getMarkdown(),
              tabId,
              baseUrl: getBaseUrl(),
              path: getPath(),
              static: isStatic(),
            };
          },

          /**
           * Processes the data and sends the markdown to the preview window.
           * @param object data The data from the document:<ul>
           * <li>string markdown The markdown</li>
           * <li>number tabId The ID of the responding tab</li>
           * <li>string baseUrl The URL prefix for relative paths (optional)</li>
           * <li>string path The path of the markdown file being displayed</li>
           * <li>boolean static <code>true</code> if the page in the tab is static,
           *     else <code>false</code> (optional)</li></ul>
           * @return {class} this
           */
          process(data) {
            /* eslint-disable no-console */
            if (!data) {
              console.log('No data, abort', this);
              return removePopup();
            }
            if (data.static) {
              console.log('Static file, only process once');
              stopSender();
            }
            console.log('Processing data from', data.tabId);
            if (previewWin) {
              const helixUrl = getHelixUrl(data.path);
              if (helixUrl) {
                console.log('Helix mode');
                // if (!previewInitialized) {
                //   diff = new diffDOM.DiffDOM();
                previewWin.location.href = helixUrl;
                //   previewInitialized = true;
                // } else {
                // TODO: partial DOM update
                // }
                disableZoom(); // TODO: enable zoom also in Helix mode
                stopSender(); // TODO: show live preview without manual refresh
              } else {
                console.log('Standalone mode');
                if (data.baseUrl) {
                  marked.setOptions({
                    baseUrl: data.baseUrl,
                  });
                }
                const md = marked(data.markdown);
                try {
                  previewWin.document.getElementById(ID).innerHTML = md;
                } catch (e) {
                  console.log('Error while processing markdown', e);
                }
              }
            } else {
              console.log('Preview window not found, cleaning up');
              return removePopup();
            }
            return this;
            /* eslint-enable no-console */
          },
        };
        if (cb) cb(ret);
        return ret;
      });
    }

    return {
      /**
       * Returns an instance of <code>HelixMarkdownPreview</code>.
       * @param {window} win The window to use (optional, defaults to <code>window</code>)
       * @param {function} callback The function to call when done (optional)
       */
      getInstance(win, callback) {
        if (!instance) {
          instance = init(win, callback);
        }
        return instance;
      },
    };
  }());
}
