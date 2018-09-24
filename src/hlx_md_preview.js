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
	 * @type number
	 */
	var activeTab = 0;

	/**
	 * The ID of the active poll interval.
	 * @type number
	 */
	var activePoll = 0;

	/**
	 * The configuration object with both default and/or custom settings.
	 * @type object
	 */
	var config;

	/**
	 * The popup window holding the preview window.
	 * @type window
	 */
	var popup;

	/**
	 * The preview window.
	 * @type window
	 */
	var previewWin;

	/**
	 * Returns the #ID.
	 * @return string The ID
	 */
	var getID = function() {
		return MarkdownPreview.ID;
	};

	// background methods

	/**
	 * Returns a new popup window for the preview
	 * @return object This object
	 */
	var createPopup = function() {
		var t = 100; // TODO: find out correct y position of tab or window
		var w = config.popupWidth;
		var h = root.innerHeight ? root.innerheight : root.screen.height-t;
		var l = (config.popupPosition == "left") ? 0 : root.screen.width-w;
		var win = root.open("popup.html", getID(), "width="+w+",height="+h+",top="+t+",left="+l);
		// TODO: add close listener to parent window and close popup if tab is closed
		var prepPreviewWin = function() {
			previewWin = win.document.getElementById(getID()+"_iframe").contentWindow;
			// set initial content
			previewWin.document.getElementById(getID()).innerHTML = "<p>Initializing...</p>"; // TODO: i18n
			// set zoom
			previewWin.document.body.style.zoom = config.popupZoom;
			var zoomCtl = win.document.getElementById(getID()+"_zoom");
			zoomCtl.value = config.popupZoom;
			zoomCtl.addEventListener("change", function() {
				previewWin.document.body.style.zoom = this.value;
			});
			// remove this load listener again
			win.removeEventListener("load", prepPreviewWin);
			// clean up as soon as popup closes
			win.addEventListener("unload", function(e){
				removePopup();
			});
		};
		win.addEventListener('load', prepPreviewWin);
		popup = win;
		return this;
	};

	/**
	 * Removes the popup window for the preview and resets the extension.
	 * @return object This object
	 */
	var removePopup = function() {
		if (popup) {
			popup.close();
		}
		popup = null;
		previewWin = null;
		return cleanUp();
	};

	/**
	 * Resets the markdown preview.
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
	 * Loads the configuration. Defaults are taken from #DEFAULT_CONFIG
	 * @param function callback The function to call when done (optional)
	 * @return object This object
	 */
	var loadConfig = function(callback) {
		// set defaults
		config = MarkdownPreview.DEFAULT_CONFIG;
		// load overrides from custom settings
		chrome.storage.sync.get(null, function(cfg) {
			for (var name in cfg) {
				config[name] = cfg[name];
			}
			if (callback) callback(config);
		});
		return this;
	};

	// content-side methods

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
	 * Retrieves the the path from the current window
	 * @return string The path
	 */
	var getPath = function() {
		var path = root.location.pathname;
		var branchCut = path.indexOf("/" + config.gitBranch + "/");
		if (branchCut > 0) {
			path = path.substring(branchCut+config.gitBranch.length+1);
		}
		return path;
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
					return ta.value ? ta.value : "\n";
				} catch (e) {
					//console.log("Error while retrieving markdown from DOM", e);
				}
			}
		}
		return "\n";
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
		 * The default configuration. Go to the Options page to override settings.
		 * @type object
		 * @static
		 */
		DEFAULT_CONFIG: {
			"urlFilters": [{
				hostSuffix: "github.com",
				pathContains: "/edit/",
				pathSuffix: ".md"
			},{
				hostEquals: "raw.githubusercontent.com",
				pathSuffix: ".md"
			}],
			"gitBranch": "master",
			"pipelineBaseUrl": null,
			"pollInterval": 1000,
			"popupWidth": 600,
			"popupPosition": "right",
			"popupZoom": 0.7
		},

		/**
		 * Initializes the markdown preview.
		 * @param function callback The function to call when done (optional)
		 * @return object This object
		 */
		init: function(callback) {
			loadConfig(function() {
				if (callback) callback();
			})
		},

		/**
		 * Starts the receiver for markdown preview of the current tab.
		 * @param number tabId The ID of the current tab
		 * @param function callback The function to call when done (optional)
		 * @return object This object
		 */
		startReceiver: function(tabId,callback) {
			this.init(function() {
				removePopup(); // make sure there is no previous popup around
				createPopup();
				activeTab = tabId; 
				if (callback) callback();
			});
			return this;
		},

		/**
		 * Stops the receiver for markdown preview.
		 * @return object This object
		 */
		stopReceiver: function() {
			return removePopup();
		},

		/**
		 * Checks if the receiver for markdown preview is active.
		 * @return boolean <code>true</code> if markdown preview receiver is active, else <code>false</code>
		 */
		isReceiverStarted: function() {
			return (popup != null);
		},

		/**
		 * Stores the ID of the currently active poll interval
		 * @param function func The function to execute while polling
		 * @return number The ID of the interval
		 */
		startPoll: function(func) {
			return activePoll = setInterval(func, config.pollInterval);
		},

		/**
		 * Assembles the data from the document for #process to consume.
		 * @param number tabId the ID of the current tab.
		 * @return object The data object:<ul>
		 * <li>string markdown The markdown</li>
		 * <li>number tabId The ID of the responding tab</li>
		 * <li>string baseUrl The URL prefix for relative paths (optional)</li>
		 * <li>string path The path of the markdown file being displayed</li>
		 * <li>boolean static <code>true</code> if the page in the tab is static,
		 *     else <code>false</code> (optional)</li></ul>
		 */
		assemble: function(tabId) {
			return {
				"markdown": getMarkdown(),
				"tabId": tabId,
				"baseUrl": getBaseUrl(),
				"path": getPath(),
				"static": isStatic()
			}
		},

		/**
		 * Returns the preview window.
		 * @return window The preview window
		 */
		getPreviewWindow: function() {
			return previewWin;
		},

		/**
		 * Checks if a Helix Pipeline is configured.
		 * @return boolean <code>true</code> if pipeline is configured, else <code>false</code>
		 */
		hasPipeline: function() {
			return (config.pipelineBaseUrl != null);
		},

		/**
		 * Processes the data and feeds the markdown to the preview window.
		 * @param object data The data from the document:<ul>
		 * <li>string markdown The markdown</li>
		 * <li>number tabId The ID of the responding tab</li>
		 * <li>string baseUrl The URL prefix for relative paths (optional)</li>
		 * <li>string path The path of the markdown file being displayed</li>
		 * <li>boolean static <code>true</code> if the page in the tab is static,
		 *     else <code>false</code> (optional)</li></ul>
		 * @return object This object
		 */
		process: function(data) {
			if (!data) {
				console.log("No data, reset");
				return removePopup();
			}
			// if (activeTab != data.tabId) {
			// 	console.log("Tab mismatch, reset",activeTab,data.tabId);
			// 	return removePopup();
			// }
			if (data.static) {
				console.log("Static file, only process once");
				cleanUp();
			}
			console.log("Processing data from",data.tabId);
			if (previewWin) {
				if (config.pipelineBaseUrl) {
					var url = config.pipelineBaseUrl;
					url += data.path;
					url = url.substring(0, url.lastIndexOf("."));
					url += ".html";
					url += "?hlx_cK=" + new Date().getTime();
					previewWin.location.href = url;
					console.log("Pipeline mode", url);
					cleanUp(); // TODO: show live preview without manual refresh
				} else {
					console.log("Standalone mode");
					if (data.baseUrl) {
						marked.setOptions({
							baseUrl: data.baseUrl
						});
					}
					var md = marked(data.markdown);
					try {
						previewWin.document.getElementById(getID()).innerHTML = md;
					} catch (e) {
						console.log("Error while processing markdown", e);
					}
				}
			} else {
				console.log("Preview window not found, clean up");
				return removePopup();
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
