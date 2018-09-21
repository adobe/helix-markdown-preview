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

;(function(root) {

'use strict';

/**
 * MarkdownPreview allows to request and process markdown from a given source.
 * @type object
 * @public
 * @static
 */
var MarkdownPreview = function() {

	/**
	 * The ID of the current tab.
	 * @private
	 * @type number
	 */
	var activeTab;
	
	/**
	 * The ID of the active poll interval.
	 * @private
	 * @type number
	 */
	var activePoll;
	
	/**
	 * Returns the #ID.
	 * @private
	 * @return string The ID
	 */
	var getID = function() {
		return MarkdownPreview.ID;
	};

	/**
	 * Returns an existing popup window for the preview
	 * @private
	 * @return window The popup window or <code>null</code>
	 */
	var getPopup = function() {
		return root[getID()];
	};

	/**
	 * Returns a new popup window for the preview
	 * @private
	 * @return window The popup window
	 */
	var createPopup = function() {
		var t = 100; // TODO: find out correct y position of window
		var w = 600; // TODO: make configurable in extension options
		var h = root.innerHeight ? root.innerheight : root.screen.height-t;
		var l = root.screen.width-w;
		var popup = root.open("preview.html", getID(), "width="+w+",height="+h+",top="+t+",left="+l);
		// TODO: add close listener to parent window and close popup if tab is closed
		setTimeout(function() {
			// set initial content
			popup.document.getElementById(getID()).innerHTML = MarkdownPreview.INIT_HTML;
			// set zoom
			popup.document.getElementById(getID()).style.zoom = MarkdownPreview.DEFAULT_ZOOM; // TODO: make configurable
			popup.document.getElementsByTagName("select")[0].addEventListener("change", function() {
				popup.document.getElementById(getID()).style.zoom = this.value;
			})
			// clean up when popup unloads
			popup.addEventListener("unload", function(e){
				removePopup();
			});
		}, 500);
		root[getID()] = popup;
		return popup;
	};

	/**
	 * Removes the popup window for the preview and cleanUps the extension.
	 * @private
	 * @return object This object
	 */
	var removePopup = function() {
		var popup = getPopup();
		if (popup) {
			popup.close();
		}
		root[getID()] = null;
		return cleanUp();
	};

	/**
	 * Resets the markdown preview.
	 * @private
	 * @return object This object
	 */
	var cleanUp = function() {
		activeTab = 0;
		if (activePoll) {
			clearInterval(activePoll);
			activePoll = 0;
		}
		return this;
	};
	
	/**
	 * Checks if the markdown file is static (raw).
	 * @return boolean <code>true</code> if markdown file is static, else <code>false</code>
	 */
	var isStatic = function() {
		return root.location.hostname.startsWith("raw.");
	};

	/**
	 * Retrieves the base URL for relative paths from the current window
	 * @return string The base URL
	 */
	var getBaseUrl = function() {
		var url = root.location.href;
		url = url.substring(0, url.lastIndexOf("/")+1);
		url = url.replace(/\/edit\//,"/raw/");
		return url;
	};

	/**
	 * Retrieves the markdown from the document.
	 * @return string The markdown
	 */
	var getMarkdown = function() {
		if (isStatic()) {
			// Get raw markdown
			try {
				return root.document.body.innerText;
			} catch (e) {
				//console.log("Error while retrieving markdown", e);
			}
		} else {
			// Get markdown from DOM
			var ta;
			var tas = root.document.getElementsByTagName("textarea");
			for (var i=0; i < tas.length; i++) {
				if (tas[i].name && tas[i].name == "value") {
					ta = tas[i];
					break;
				}
			}
			if (ta) {
				// github is in edit mode
				// retrieve markdown from textarea
				try {
					return ta.value ? ta.value : DEFAULT_MD;
				} catch (e) {
					//console.log("Error while retrieving markdown from DOM", e);
				}
			}
		}
		return DEFAULT_MD;
	};

	// public API
	return {

		/**
		 * The common ID used to identify windows and elements related to this extension.
		 * @type string
		 * @static
		 */
		ID: "Helix_Markdown_Preview",

		/**
		 * The default poll interval in milliseconds to request new markdown with.
		 * @type number
		 * @static
		 */
		POLL_INTERVAL: 1000,

		/**
		 * The defaut markdown to use if none can be retrieved from the document.
		 * @type string
		 * @static
		 */
		DEFAULT_MD: "\n",

		/**
		 * The default zoom factor to use for the preview.
		 * @type number
		 * @static
		 */
		DEFAULT_ZOOM: 0.7,

		/**
		 * The HTML to display while loading the actual preview.
		 * @type string
		 * @static
		 */
		INIT_HTML: "<p>Initializing...</p>",

		/**
		 * Initializes the markdown preview for a new tab
		 * @param number tabId The ID of the current tab
		 * @param boolean popup <code>true</code> if preview window should be launched,
		 * else <code>false</code>
		 * @return object This object
		 */
		init: function(tabId, popup) {
			if (popup) {
				removePopup(); // make sure there is no previous popup around
				createPopup();
			} else {
				cleanUp(); //just clean up
			}
			activeTab = tabId; 
			return this;
		},

		/**
		 * Stores the ID of the currently active poll interval
		 * @param number id The ID of the currently active poll interval
		 * @return object This object
		 */
		setPollInterval: function(id) {
			activePoll = id;
		},

		/**
		 * Assembles the data from the document for #process to consume:<ul>
		 * <li>string markdown The markdown</li>
		 * <li>number tabId The ID of the responding tab</li>
		 * <li>string baseUrl The URL prefix for relative paths (optional)</li>
		 * <li>boolean static <code>true</code> if the page in the tab is static,
		 *     else <code>false</code> (optional)</li></ul>
		 * @return object The data object
		 */
		assemble: function() {
			return {
				"markdown": getMarkdown(),
				"tabId": activeTab,
				"baseUrl": getBaseUrl(),
				"static": isStatic()
			}
		},

		/**
		 * Processes the data and feeds the markdown to the preview window.
		 * @param object data The data from the document:<ul>
		 * <li>string markdown The markdown</li>
		 * <li>number tabId The ID of the responding tab</li>
		 * <li>string baseUrl The URL prefix for relative paths (optional)</li>
		 * <li>boolean static <code>true</code> if the page in the tab is static,
		 *     else <code>false</code> (optional)</li></ul>
		 * @return object This object
		 */
		process: function(data) {
			if (!data) {
				console.log("No data, reset");
				return removePopup();
			}
			if (activeTab != data.tabId) {
				console.log("Tab mismatch, reset",activeTab,data.tabId);
				return removePopup();
			}
			if (data.static) {
				console.log("Static file, only process once");
				cleanUp();
			}
			console.log("Processing data from",data.tabId);
			var popup = getPopup();
			if (popup) {
				if (data.baseUrl) {
					marked.setOptions({
						baseUrl: data.baseUrl
					});
				}
				var md = marked(data.markdown);
				setTimeout(function() {
					try {
						popup.document.getElementById(getID()).innerHTML = md;
					} catch (e) {
						console.log("Error while processing markdown", e);
					}
				}, 500);
			} else {
				console.log("Popup window not found, clean up");
				return cleanUp();
			}
			return this;
		}
	}

}();

// make Helix.MarkdownPreview available in context of 'root'
if (typeof root.Helix == 'undefined') {
	root.Helix = {};
}
root.Helix.MarkdownPreview = MarkdownPreview;

})(this || (typeof window !== 'undefined' ? window : global));
