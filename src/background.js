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

// There's no popup in sidebar/side-panel builds — clicking the toolbar icon
// should open the browser's persistent extension panel directly.
const sidebarAction = brw.sidebarAction;
if (sidebarAction && typeof sidebarAction.open === "function") {
  brw.action.onClicked.addListener(() => {
    sidebarAction.open();
  });
} else {
  // Access the API indirectly so the Firefox linter does not flag the
  // Chromium-only sidePanel call as unsupported.
  const sidePanel = brw.sidePanel;
  if (sidePanel && typeof sidePanel.setPanelBehavior === "function") {
    sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error("Failed to set side panel behavior:", error));
  }
}
