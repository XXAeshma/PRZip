# PR Zipper

A browser extension that adds a **Download All** button to GitHub Pull Request pages, letting you download every changed file as a single ZIP — with the original folder structure preserved.

![Chrome Extension](https://img.shields.io/badge/platform-Chrome-4285F4?logo=googlechrome&logoColor=white)
![Edge Extension](https://img.shields.io/badge/platform-Edge-0078D7?logo=microsoftedge&logoColor=white)
![Firefox Add-on](https://img.shields.io/badge/platform-Firefox-FF7139?logo=firefox&logoColor=white)
![Manifest V3](https://img.shields.io/badge/manifest-v3-brightgreen)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

## Features

- **One-click download** — grab all changed files from any PR as a `.zip`
- **Folder structure preserved** — files land in the same paths they have in the repo
- **Works on public and private repos** — public repos work without auth; private repos prompt for a token
- **Paginated file fetching** — handles PRs with 100+ changed files
- **Multiple download strategies** — falls back through the Blob API → Contents API → Raw download to maximize reliability
- **SPA-aware** — survives GitHub's Turbo/Pjax navigation without losing the button
- **Dark mode support** — the token modal respects `prefers-color-scheme`
- **Cross-browser** — native builds for Chrome, Edge, and Firefox

## Installation

### Chrome / Edge (from source)

1. Clone this repository:
   ```bash
   git clone https://github.com/XXAeshma/PRZip.git
   ```
2. Open **chrome://extensions** (Chrome) or **edge://extensions** (Edge).
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `chrome-edge/` folder inside the cloned repo.
5. Navigate to any GitHub pull request's **Files changed** tab — the green **Download All** button will appear in the toolbar.

### Firefox (from source)

1. Clone this repository:
   ```bash
   git clone https://github.com/XXAeshma/PRZip.git
   ```
2. Open **about:debugging#/runtime/this-firefox** in Firefox.
3. Click **Load Temporary Add-on…** and select the `firefox/manifest.json` file.
4. Navigate to any GitHub pull request's **Files changed** tab — the green **Download All** button will appear in the toolbar.

> **Note:** Temporary add-ons in Firefox are removed when the browser closes. For persistent installation, package the `firefox/` folder as a `.xpi` and install via **about:addons**.

### Optional: set a GitHub token

A token is **not required** for public repos but is needed for private repos and avoids API rate limits.

1. Click the PR Zipper extension icon in your browser toolbar.
2. Paste a **Classic PAT** with the `repo` scope, or a **Fine-grained PAT** with `Contents: Read`.
3. Click **Save Token**.

You can create a Classic PAT here:  
<https://github.com/settings/tokens/new?scopes=repo&description=PR+File+Zipper>

## Project Structure

```
chrome-edge/                # Chrome & Edge build
├── manifest.json           # MV3 manifest (Chrome/Edge)
├── content.js              # Injected into PR pages — button logic & download
├── popup.html              # Extension popup UI (token management)
├── popup.js                # Popup interaction logic
├── background.js           # Service worker (minimal, MV3 requirement)
├── styles.css              # Injected styles for button & modal
├── jszip.min.js            # Bundled JSZip library for ZIP generation
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png

firefox/                    # Firefox build
├── manifest.json           # MV3 manifest with Gecko settings
├── content.js              # Firefox-adapted content script (uses browser.*)
├── popup.html              # Extension popup UI
├── popup.js                # Popup interaction logic
├── background.js           # Background script (uses browser.*)
├── styles.css              # Injected styles for button & modal
├── jszip.min.js            # Bundled JSZip library for ZIP generation
├── browser-polyfill.js     # WebExtension browser API polyfill
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Browser differences

The Chrome/Edge and Firefox builds share the same core logic. The Firefox version differs in:

- Uses the `browser.*` namespace (via `browser-polyfill.js`) instead of `chrome.*`.
- Includes `browser_specific_settings.gecko` in the manifest for Firefox compatibility.
- Storage calls use promise-based APIs instead of callbacks.

## How It Works

1. A content script is injected on `github.com/*/*/pull/*` pages.
2. When the **Files changed** tab is detected, the script finds the toolbar and injects a **Download All** button.
3. On click, it fetches the PR metadata and the full list of changed files via the GitHub API.
4. Each file is downloaded (Blob API → Contents API → raw fallback) and added to an in-memory ZIP using JSZip.
5. The ZIP is offered as a browser download: `owner-repo-prN-files.zip`.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist the optional GitHub PAT locally |
| `https://github.com/*` | Inject the download button on PR pages |
| `https://api.github.com/*` | Fetch PR metadata and file contents |
| `https://raw.githubusercontent.com/*` | Fallback raw file downloads |

## Contributing

This is a personal project and is **not accepting contributions** at this time. Feel free to fork it for your own use.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
