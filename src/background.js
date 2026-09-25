// Background script for Browser Mirror extension
//
// No message relay is needed: the sidebar queries the active tab's content
// script directly via tabs.sendMessage. This script only seeds default
// settings and wires the toolbar icon to open the sidebar/side panel.

// API compatibility
const brw = typeof browser !== "undefined" ? browser : chrome;

brw.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await brw.storage.local.set({ theme: "dark" });
    console.log("Default settings initialized");
  }
});

// There's no popup — clicking the toolbar icon should open the sidebar directly.
if (typeof browser !== "undefined" && browser.sidebarAction) {
  // Firefox: with no default_popup, clicking the action icon fires
  // action.onClicked instead of doing nothing, so open the sidebar here.
  browser.action.onClicked.addListener(() => {
    browser.sidebarAction.open();
  });
} else if (typeof chrome !== "undefined" && chrome.sidePanel) {
  // Chrome: this is the documented way to make the action icon open the
  // side panel directly, without needing an onClicked listener.
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Failed to set side panel behavior:", error));
}
