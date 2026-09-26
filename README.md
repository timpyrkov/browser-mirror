<h1><p align="left">
  <img src="https://github.com/timpyrkov/browser-mirror/blob/master/src/icons/icon-128.png?raw=true" alt="Browser Mirror logo" height="25" style="vertical-align: middle; margin-right: 10px;">
  <span style="font-size:2.5em; vertical-align: middle;"><b>Browser Mirror</b></span>
</p></h1>

Horizontally mirror the current browser tab or its main video area. Works as a sidebar extension in Mozilla Firefox and as a side panel in Google Chrome.

## Build

```bash
npm run build
```

This creates browser-specific packages under `dist/`:

- `dist/firefox/` — load as a temporary extension in `about:debugging`, or package as a `.zip` for addons.mozilla.org.
- `dist/chrome/` — load as an unpacked extension at `chrome://extensions` with Developer mode enabled, or package as a `.zip` for the Chrome Web Store.

## Usage

1. Open the extension from the toolbar icon to show the sidebar/side panel.
2. Click **Mirror page** to flip the entire active tab horizontally.
3. Click **Mirror video** to flip only the largest visible video element (e.g. the main player on YouTube, Vimeo, or any page with a `<video>` tag).
4. Click the same button again to restore the original orientation.

The toolbar also contains:

- an **interface-language** selector (English, Spanish, Italian, French, German, Russian, Korean, Japanese, Chinese),
- a **theme toggle** (dark / light).

The sidebar refreshes automatically when you switch tabs, so it always shows the mirror state of the tab currently in focus.

## Install permanently in Firefox

Temporary add-ons loaded via `about:debugging` are removed when Firefox restarts. To keep Browser Mirror installed across restarts, package `dist/firefox/` as a `.zip` and submit it to [addons.mozilla.org](https://addons.mozilla.org/developers) to receive a signed `.xpi`.

If you want to publish it publicly, choose **On this site** during submission so it appears on the Firefox Add-ons website and updates automatically for users.

## Privacy

Browser Mirror does not collect, store, or transmit any data. See [`PRIVACY.md`](PRIVACY.md) for the full privacy policy.

## Architecture

The project structure mirrors the [browser-translations](https://github.com/timpyrkov/browser-translations) extension:

- `src/` — source files shared between browsers.
- `manifests/chrome.json` and `manifests/firefox.json` — browser-specific Manifest V3 manifests.
- `build.js` — copies shared source files and the right manifest into `dist/[browser]/`.
