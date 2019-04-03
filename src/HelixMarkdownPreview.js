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

// only do this once
if (typeof window.HelixMarkdownPreview === 'undefined') {
  /**
   * HelixMarkdownPreview uses a <code>Sender</code> and a <code>Receiver</code>
   * to request and process markdown from a given source and provides a live preview.
   */
  /* eslint-disable-next-line no-unused-vars, func-names */
  window.HelixMarkdownPreview = (function () {
    const ID = 'HelixMarkdownPreview';
    let receiverInst;
    let senderInst;
    let config;

    /**
     * Initializes the configuration and returns the specified object.
     * @param {object} obj The object to return
     * @param {function} callback The function to call when done (optional)
     */
    function initInstance(obj, callback) {
      // load default config and overrides from storage
      chrome.storage.sync.get(null, (customConfig) => {
        // defaults
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
          pollInterval: 500,
          popupMinWidth: 500,
          popupPosition: 'right',
          popupZoom: 0,
        },
        customConfig);
        // console.log('Current config', config);

        const ret = Object.assign(obj, {
          /**
           * The common ID used to identify windows and elements related to this extension.
           * @return {string} The ID
           */
          get ID() {
            return ID;
          },
        });
        if (callback) callback(ret);
        return ret;
      });
    }

    /**
     * Initializes the <code>HelixMarkdownPreview.Receiver</code> instance.
     * @private
     * @param {function} callback The function to call when done (optional)
     */
    function initReceiver(callback) {
      const receiverWin = window;
      let activeTab = null;
      let popup = null;
      let previewWin = null;

      /**
       * Enables zooming in the preview window.
       * @private
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
       * Resets zoom to 100% and disables zooming in the preview window.
       * @private
       */
      function disableZoom() {
        if (!popup || !previewWin) return;
        const zoomCtl = popup.document.getElementById(`${ID}_zoom`);
        zoomCtl.value = 1;
        zoomCtl.disabled = true;
        previewWin.document.body.style.zoom = 1;
        // remove zoom-related listeners
        while (zoomCtl.listeners && zoomCtl.listeners.length > 0) {
          const l = zoomCtl.listeners.shift();
          zoomCtl.removeEventListener(l.name, l.func);
        }
        while (popup.listeners && popup.listeners.length > 0) {
          const l = popup.listeners.shift();
          popup.removeEventListener(l.name, l.func);
        }
      }

      /**
       * Removes the preview window and resets the extension.
       * @private
       */
      function removePopup() {
        if (popup) {
          popup.close();
        }
        chrome.extension.getViews({ type: 'tab' }).forEach((v) => {
          v.close();
        });
        popup = null;
        previewWin = null;
      }

      /**
       * Creates a new popup window for the markdown preview.
       * @private
       * @param {function} func The function to call when done (optional)
       */
      function createPopup(func) {
        removePopup();
        const t = 0; // TODO: get actual y offset
        let w = config.popupWidth || receiverWin.screen.width - activeTab.width;
        if (w < config.popupMinWidth) w = config.popupMinWidth;
        const h = receiverWin.screen.height;
        const l = (config.popupPosition === 'left') ? 0 : receiverWin.screen.width - w;
        popup = receiverWin.open('popup.html', ID, `width=${w},height=${h},top=${t},left=${l}`);
        // TODO: add close listener to parent window and close popup if tab is closed
        function prepPreviewWin() {
          previewWin = popup.document.getElementById(`${ID}_iframe`).contentWindow;
          // set initial content
          previewWin.document.getElementById(ID).innerHTML = '<p>Initializing...</p>'; // TODO: i18n
          popup.addEventListener('unload', () => {
            HelixMarkdownPreview.getReceiver((receiver) => {
              receiver.stop();
            });
          });
          popup.removeEventListener('load', prepPreviewWin);
          // remove this listener again
          enableZoom();
          if (func) func();
        }
        popup.addEventListener('load', prepPreviewWin);
      }

      /**
       * Returns the Helix URL if path is a markdown file and Helix is configured to be used.
       * @private
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
        return url;
      }

      /**
       * Prefixes a relative URL with the Helix base URL.
       * @private
       * @param {string} url The URL to prefix
       * @return {string} The prefixed URL
       */
      function rewriteLink(url) {
        if (url.startsWith('http')
          || url.startsWith('javascript')
          || url.startsWith('#')) {
          // leave these URLs alone
          return url;
        }
        if (url.startsWith('/')) {
          // URL absolute without host
          return `${config.helixBaseUrl}${url}`;
        }
        if (url.startsWith('chrome-extension')) {
          // chrome extension URL
          return url.replace(`chrome-extension://${chrome.runtime.id}`, `${config.helixBaseUrl}`);
        }
        // assume URL relative to current file
        if (config.helixUrl) {
          const prefix = config.helixUrl.substring(0, config.helixUrl.lastIndexOf('/') + 1);
          return `${prefix}${url}`;
        }
        return url;
      }

      /**
       * Rewrites links in the specified document.
       * @private
       * @param {Element} doc The document element
       * @return {Element} The document element with rewritten links
       */
      function rewriteLinks(doc) {
        const elems = Array.prototype.concat.call(
          Array.from(doc.getElementsByTagName('link')),
          Array.from(doc.getElementsByTagName('script')),
          Array.from(doc.getElementsByTagName('img')),
          Array.from(doc.getElementsByTagName('a')),
        );
        elems.forEach((elem) => {
          const e = elem;
          if (e.src) {
            e.src = rewriteLink(e.src);
          }
          if (e.href) {
            e.href = rewriteLink(e.href);
          }
          if (elem.srcset) {
            const srcSet = e.srcset.split(',');
            const newSrcSet = [];
            srcSet.forEach(src => newSrcSet.push(rewriteLink(src)));
            e.srcset = newSrcSet.join(',');
          }
        });
        return doc;
      }

      /**
       * Returns an <code><html></code> document element based on the specified HTML.
       * @private
       * @param {string} html The HTML string
       * @param {string} currentUrl The URL of the current file
       * @return {Element} The document element
       */
      function getDocument(html, currentUrl) {
        const doc = receiverWin.document.createElement('html');
        doc.innerHTML = html.trim();
        doc.lastChild.style.fontSize = '100%'; // chrome injects a mysterious stylesheet setting body font-size to 75%...
        return rewriteLinks(doc, currentUrl);
      }

      // initialize receiver object
      initInstance({
        /**
         * Starts the receiver.
         * @param {object} tab The current browser tab
         * @return {object} this
         */
        start(tab) {
          activeTab = tab;
          createPopup(() => {
            chrome.tabs.sendMessage(tab.id, { id: chrome.runtime.id, action: 'send' });
          });
          // listen for messages from the sender
          chrome.runtime.onMessage.addListener((data, context) => {
            if (activeTab && context.id === chrome.runtime.id && context.tab.id === activeTab.id) {
              this.receive(data);
            }
          });
          chrome.runtime[`${ID}_receiverOn`] = true;
          return this;
        },

        /**
         * Checks if the receiver is active.
         * @return boolean <code>true</code> if running, else <code>false</code>
         */
        isRunning() {
          return chrome.runtime[`${ID}_receiverOn`];
        },

        /**
         * Stops the receiver.
         * @return {object} this
         */
        stop() {
          removePopup();
          if (activeTab) {
            chrome.tabs.sendMessage(activeTab.id, { id: ID, action: 'stop' });
            activeTab = null;
          }
          chrome.runtime[`${ID}_receiverOn`] = false;
          return this;
        },

        /**
         * Receives and processes the data, then sends markdown to the preview window.
         * @param object data The data from the document:<ul>
         * <li>string markdown The markdown</li>
         * <li>string baseUrl The URL prefix for relative paths (optional)</li>
         * <li>string path The path of the markdown file being displayed</li>
         * <li>boolean static <code>true</code> if the content is static,
         *     else <code>false</code> (optional)</li></ul>
         * @return {object} this
         */
        receive(data) {
          if (!data) {
            // console.log('No data, abort');
            return this;
          }
          if (data.static) {
            // console.log('Static preview');
          } else {
            // console.log('Live preview');
          }
          // console.log('Processing data');
          if (previewWin) {
            config.helixUrl = getHelixUrl(data.path);
            if (config.helixUrl) {
              // console.log('Helix rendering');
              disableZoom(); // TODO: enable zooming also in Helix mode
              const xhttp = new XMLHttpRequest();
              xhttp.onreadystatechange = (evt) => {
                const xhr = evt.target;
                if (xhr.readyState === 4 && xhr.status === 200) {
                  const newDoc = getDocument(xhr.responseText);
                  try {
                    if (!popup[`${ID}_init`]) {
                      previewWin.document.documentElement.replaceWith(newDoc);
                      popup[`${ID}_init`] = true;
                    } else {
                      const oldBody = previewWin.document.body;
                      diffDOM.apply(oldBody, diffDOM.diff(oldBody, newDoc.lastChild));
                    }
                  } catch (e) {
                    // console.log('Unable to process Helix output');
                  }
                }
              };
              xhttp.open('POST', config.helixUrl);
              xhttp.setRequestHeader('Content-Type', 'application/json');
              xhttp.send(JSON.stringify({
                content: {
                  body: data.markdown,
                },
              }));
            } else {
              // console.log('Standalone rendering');
              if (data.baseUrl) {
                marked.setOptions({
                  baseUrl: data.baseUrl,
                });
              }
              const md = marked(data.markdown);
              try {
                previewWin.document.getElementById(ID).innerHTML = md;
              } catch (e) {
                // console.log('Error while processing markdown', e);
              }
            }
          } else {
            // console.log('Preview window not found, cleaning up');
            return this;
          }
          return this;
        },
      },
      callback);
    }

    /**
     * Initializes the <code>HelixMarkdownPreview.Sender</code> instance.
     * @private
     * @param {function} callback The function to call when done (optional)
     */
    function initSender(callback) {
      const senderWin = window;
      let data;
      let receiverId;
      let editor;

      /**
       * Checks if the markdown file is static (raw).
       * @private
       * @return {boolean} <code>true</code> if content is static,
       *                   else <code>false</code>
       */
      function isStatic() {
        return senderWin.location.hostname.startsWith('raw.');
      }

      /**
       * Retrieves the base URL for relative paths from the current context.
       * @private
       * @return {string} The base URL
       */
      function getBaseUrl() {
        let url = senderWin.location.href;
        url = url.substring(0, url.lastIndexOf('/') + 1);
        url = url.replace(/\/edit\//, '/raw/');
        return url;
      }

      /**
       * Retrieves the path from the current context.
       * @private
       * @return {string} The path
       */
      function getPath() {
        let path = senderWin.location.pathname;
        const branchCut = path.indexOf(`/${config.gitBranch}/`);
        if (branchCut > 0) {
          path = path.substring(branchCut + config.gitBranch.length + 1);
        }
        return path;
      }

      /**
       * The change listener for the markdown editor to enable live preview.
       * @private
       */
      function editorChangeListener() {
        if (!senderWin[`${ID}_timeout`]) {
          senderWin[`${ID}_timeout`] = senderWin.setTimeout(() => {
            // eslint-disable-next-line no-use-before-define
            sendData();
            senderWin[`${ID}_timeout`] = 0;
          }, config.pollInterval);
        }
      }

      /**
       * Attempts to find an editor in the current window.
       * @private
       * @return {Element} The editor or <code>null</code>
       */
      function getEditor() {
        const textAreas = senderWin.document.getElementsByTagName('textarea');
        for (let i = 0; i < textAreas.length; i += 1) {
          const input = textAreas[i];
          if (input.name === 'value') {
            input.addEventListener('change', editorChangeListener);
            return input;
          }
        }
        return null;
      }

      /**
       * Retrieves the markdown from the document.
       * @private
       * @return {string} The markdown
       */
      function getMarkdown() {
        if (data.static) {
          // get raw markdown
          try {
            return senderWin.document.body.innerText;
          } catch (e) {
            // console.log('Error while retrieving raw markdown', e);
          }
        } else {
          // github is in edit mode
          // retrieve markdown from editor
          if (!editor) {
            editor = getEditor();
          }
          try {
            return editor.value ? editor.value : '\n';
          } catch (e) {
            // console.log('Error while retrieving markdown from DOM', e);
          }
        }
        return '\n';
      }

      /**
       * Assembles the data from the current browser window and sends it
       * to the receiver.
       * @private
       * @return {object} The data object:<ul>
       * <li>string markdown The markdown</li>
       * <li>string path The path of the markdown file being displayed</li>
       * <li>boolean static <code>true</code> if the content is static,
       *     else <code>false</code> (optional)</li></ul>
       * <li>string baseUrl The URL prefix for relative paths (optional)</li>
       */
      function sendData() {
        if (!data) {
          data = {
            path: getPath(),
            static: isStatic(),
            baseUrl: getBaseUrl(),
          };
        }
        data.markdown = getMarkdown();
        chrome.runtime.sendMessage(receiverId, data);
      }

      // initialize sender object
      initInstance({
        /**
         * Prepares the sender for sending markdown to the receiver.
         * @return {object} this
         */
        start() {
          chrome.runtime.onMessage.addListener(({ id, action }) => {
            if (action === 'send') {
              this.send(id);
            }
            if (action === 'stop') {
              this.stop();
            }
          });
          chrome.runtime[`${ID}_senderOn`] = true;
          return this;
        },

        /**
         * Checks if the sender is active.
         * @return boolean <code>true</code> if running, else <code>false</code>
         */
        isRunning() {
          return chrome.runtime[`${ID}_senderOn`];
        },

        /**
         * Sends markdown from the content window to a processor.
         * @param {string} id the ID of the receiver
         * @return {object} this
         */
        send(id) {
          receiverId = id;
          sendData();
          return this;
        },

        /**
         * Terminates the sender.
         * @return {object} this
         */
        stop() {
          if (editor) {
            editor.removeEventListener('change', editorChangeListener);
            editor = null;
          }
          receiverId = null;
          chrome.runtime[`${ID}_senderOn`] = false;
          return this;
        },
      },
      callback);
    }

    return {
      /**
       * Returns an instance of <code>HelixMarkdownPreview.Receiver</code>.
       * @static
       * @param {function} callback The function to call when done (optional)
       */
      getReceiver(callback) {
        if (!receiverInst) {
          receiverInst = initReceiver(callback);
        }
        return receiverInst;
      },

      /**
       * Returns an instance of <code>HelixMarkdownPreview.Sender</code>.
       * @static
       * @param {function} callback The function to call when done (optional)
       */
      getSender(callback) {
        if (!senderInst) {
          senderInst = initSender(callback);
        }
        return senderInst;
      },
    };
  }());
}
