# Privacy Policy for Browser Mirror

**Effective date:** September 25, 2026

## What data Browser Mirror collects

Browser Mirror does **not** collect, store, or transmit any personal data.

## What Browser Mirror does

Browser Mirror is a browser extension that applies a local CSS visual transformation (`transform: scaleX(-1)`) to:

- the currently active web page, or
- the largest visible video element on the active page.

All transformations happen locally in the user's browser. No page content, URLs, browsing history, or user preferences are sent to any external server.

## Permissions used and why

- **tabs / activeTab**: to identify the currently focused tab so the sidebar can mirror the right page.
- **scripting**: to run the small content script that applies the mirror effect.
- **storage**: to remember the user's theme and interface-language preferences.
- **`<all_urls>`**: the extension works on any website the user visits; this host permission is required to inject the mirror script.

## Contact

For questions about this privacy policy, please open an issue in the project repository:
https://github.com/timpyrkov/browser-mirror
