# Helix Markdown Preview
Google Chrome Extension to preview markdown files while editing.

## Installation

0. Clone this repository
1. Open Chrome and go to chrome://extensions
2. Turn on `Developer mode`
   ![step2](install_developer_mode.png)
3. Click `Load unpacked`
   ![step3](install_load_unpacked.png)
4. Navigate to the `src` directory in your local clone and select it
5. Now the extension is installed and active.
   Check if your Extensions page shows a box like this:
   ![step4](install_extension_box.png)
   and the toolbar shows a grayed out Helix icon:
   ![step4](install_toolbar_icon.png)

## Usage

1. Navigate to a markdown (*.md) file on `github.com`.
2. Switch to edit mode. Notice that Helix icon will be in color now.
3. Click the Helix icon in the toolbar.
4. A popup opens, showing the rendered markdown.
5. Edit the markdown on `github.com` and observe the changes in the popup.

## 3rd party dependencies
Helix Markdown Preview uses:
* [Marked](https://github.com/markedjs/marked) JS library to render markdown in the preview
* [Primer](https://primer.style/) CSS for GitHub-style output
Both are released under [MIT License](https://opensource.org/licenses/MIT).
