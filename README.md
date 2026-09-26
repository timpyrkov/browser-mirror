<h1><p align="left">
  <img src="https://github.com/timpyrkov/browser-mirror/blob/master/src/icons/icon-128.png?raw=true" alt="Browser Mirror logo" height="25" style="vertical-align: middle; margin-right: 10px;">
  <span style="font-size:2.5em; vertical-align: middle;"><b>Browser Mirror</b></span>
</p></h1>

Horizontally mirror the current browser tab or its main video area. Works in Mozilla Firefox, Google Chrome, Opera, and Yandex Browser.

## Build

```bash
npm run build
```

This creates browser-specific packages under `dist/`:

- `dist/firefox/` — load as a temporary extension in `about:debugging`, or package as a `.zip` for addons.mozilla.org.
- `dist/chrome/` — load as an unpacked extension at `chrome://extensions` with Developer mode enabled, or package as a `.zip` for the Chrome Web Store.
- `dist/opera/` — load as an unpacked extension at `opera://extensions` with Developer mode enabled. The interface uses Opera's extension sidebar.
- `dist/yandex/` — load as an unpacked extension at `browser://extensions` with Developer mode enabled. The interface opens as a toolbar popup because Yandex Browser does not document an extension side-panel API.

## Install for development

Run `npm run build` first, then follow the instructions for your browser.

### Firefox

1. Open `about:debugging`.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on…**.
4. Select `dist/firefox/manifest.json`.
5. Open the Browser Mirror sidebar from its toolbar button. Temporary add-ons are removed when Firefox restarts.

### Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** in the upper-right corner.
3. Click **Load unpacked**.
4. Select the `dist/chrome/` folder.
5. Optionally pin Browser Mirror from Chrome's Extensions menu. After rebuilding, return to `chrome://extensions` and click **Reload** on its extension card.

### Opera

1. Open `opera://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the `dist/opera/` folder.
5. Open Browser Mirror from Opera's sidebar. After rebuilding, return to `opera://extensions` and reload the extension.

### Yandex Browser

1. Open `browser://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked extension**.
4. Select the `dist/yandex/` folder. If the file chooser requires a file, select `dist/yandex/manifest.json`.
5. Open Browser Mirror from its toolbar button. After rebuilding, return to `browser://extensions` and reload the extension; if no reload control is available, remove it and load it again.

## Usage

1. Open the extension from the toolbar or sidebar icon to show its sidebar, side panel, or popup.
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
- `manifests/` — Manifest V3 configurations for Firefox, Chrome, Opera, and Yandex Browser.
- `build.js` — copies shared source files and the right manifest into `dist/[browser]/`.
