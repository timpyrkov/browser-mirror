// API compatibility
const brw = typeof browser !== "undefined" ? browser : chrome;

import { t, UI_STRINGS, UI_FLAGS, detectBrowserLanguage } from "./i18n.js";

const pageBtn = document.getElementById("pageBtn");
const videoBtn = document.getElementById("videoBtn");
const statusArea = document.getElementById("statusArea");
const welcomeText = document.getElementById("welcomeText");
const appTitle = document.getElementById("appTitle");
const uiLangSelect = document.getElementById("uiLangSelect");
const videoHint = document.getElementById("videoHint");

let currentState = { page: false, video: false, videoFound: false };
let currentLang = "en";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "ru", name: "Russian" },
  { code: "ko", name: "Korean" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" },
];

function clearChildren(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function populateUiLangSelect() {
  clearChildren(uiLangSelect);
  for (const l of LANGUAGES) {
    const option = document.createElement("option");
    option.value = l.code;
    option.textContent = `${UI_FLAGS[l.code] || ""} ${l.code.toUpperCase()}`.trim();
    uiLangSelect.appendChild(option);
  }
}

function showStatus(message) {
  clearChildren(statusArea);
  const p = document.createElement("p");
  p.className = "status-text";
  p.textContent = message;
  statusArea.appendChild(p);
}

let lastError = null;

function showError(key, ...args) {
  lastError = { key, args };
  clearChildren(statusArea);
  const p = document.createElement("p");
  p.className = "error-text";
  p.textContent = t(currentLang, key, ...args);
  statusArea.appendChild(p);
}

function clearError() {
  lastError = null;
}

function renderWelcome() {
  clearError();
  if (welcomeText) {
    welcomeText.textContent = t(currentLang, "welcomeText");
    clearChildren(statusArea);
    statusArea.appendChild(welcomeText);
  }
}

function renderButtons() {
  const pageLabel = currentState.page ? t(currentLang, "pageMirrorOn") : t(currentLang, "pageMirrorOff");
  const videoLabel = currentState.video ? t(currentLang, "videoMirrorOn") : t(currentLang, "videoMirrorOff");

  pageBtn.textContent = pageLabel;
  pageBtn.title = pageLabel;
  videoBtn.textContent = videoLabel;
  videoBtn.title = videoLabel;

  // Keep both buttons gold/orange regardless of mirror state.
  pageBtn.className = "btn btn-green";
  videoBtn.className = "btn btn-green";
}

function renderState() {
  clearError();
  renderButtons();

  const pageStatus = currentState.page ? t(currentLang, "statusMirrored") : t(currentLang, "statusNormal");
  const videoStatus = currentState.videoFound
    ? currentState.video ? t(currentLang, "statusMirrored") : t(currentLang, "statusNormal")
    : t(currentLang, "videoNotFound");

  clearChildren(statusArea);
  const pageP = document.createElement("p");
  pageP.className = "status-text";
  pageP.textContent = t(currentLang, "pageStatus", pageStatus);
  const videoP = document.createElement("p");
  videoP.className = "status-text";
  videoP.textContent = t(currentLang, "videoStatus", videoStatus);
  statusArea.appendChild(pageP);
  statusArea.appendChild(videoP);
}

async function getActiveTab() {
  const [tab] = await brw.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScript(tabId) {
  await brw.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

function isSpecialPage(url) {
  return !url
    || /^(about|chrome|edge|opera|browser|moz-extension|chrome-extension):/i.test(url)
    || /^https?:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore|addons\.mozilla\.org|addons\.opera\.com)(\/|$)/i.test(url);
}

async function sendCommand(tabId, command) {
  return await brw.tabs.sendMessage(tabId, { command });
}

async function refreshState() {
  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      showError("errNoActiveTab");
      return;
    }
    if (isSpecialPage(tab.url)) {
      showError("errSpecialPage");
      return;
    }

    await ensureContentScript(tab.id);
    const response = await sendCommand(tab.id, "get-state");
    if (!response || response.status !== "success") {
      showError("errContentScript");
      return;
    }

    currentState = {
      page: response.page,
      video: response.video,
      videoFound: response.videoFound,
    };
    renderState();
  } catch (error) {
    console.error("Failed to refresh state:", error);
    const err = describeError(error);
    showError(err.key, ...err.args);
  }
}

async function togglePage() {
  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      showError("errNoActiveTab");
      return;
    }
    if (isSpecialPage(tab.url)) {
      showError("errSpecialPage");
      return;
    }

    await ensureContentScript(tab.id);
    const response = await sendCommand(tab.id, "toggle-page");
    if (!response || response.status !== "success") {
      showError("errContentScript");
      return;
    }

    currentState = {
      page: response.page,
      video: response.video,
      videoFound: currentState.videoFound,
    };
    renderState();
  } catch (error) {
    console.error("Failed to toggle page mirror:", error);
    const err = describeError(error);
    showError(err.key, ...err.args);
  }
}

async function toggleVideo() {
  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      showError("errNoActiveTab");
      return;
    }
    if (isSpecialPage(tab.url)) {
      showError("errSpecialPage");
      return;
    }

    await ensureContentScript(tab.id);
    const response = await sendCommand(tab.id, "toggle-video");
    if (!response || response.status !== "success") {
      showError("errContentScript");
      return;
    }

    currentState = {
      page: response.page,
      video: response.video,
      videoFound: response.videoFound,
    };
    renderState();
  } catch (error) {
    console.error("Failed to toggle video mirror:", error);
    const err = describeError(error);
    showError(err.key, ...err.args);
  }
}

function describeError(error) {
  const msg = (error && error.message) || String(error);
  if (/extensions? gallery cannot be scripted|chrome web store|addons\.mozilla\.org|addons\.opera\.com|cannot access (?:the )?contents of (?:the )?url/i.test(msg)) {
    return { key: "errSpecialPage", args: [] };
  }
  return { key: "errContentScript", args: [] };
}

function applyUiLanguage(lang) {
  currentLang = UI_STRINGS[lang] ? lang : "en";
  uiLangSelect.value = currentLang;

  document.title = t(currentLang, "appTitle");
  appTitle.textContent = t(currentLang, "appTitle");
  if (brw.sidebarAction && brw.sidebarAction.setTitle) {
    brw.sidebarAction.setTitle({ title: t(currentLang, "appTitle") });
  }

  uiLangSelect.title = t(currentLang, "uiLangLabel");

  // Update button labels in the new language.
  renderButtons();

  // If the status area already shows state text or an error, re-render it in
  // the new language so the whole UI stays consistent.
  if (lastError) {
    showError(lastError.key, ...lastError.args);
  } else if (statusArea.querySelector(".status-text")) {
    renderState();
  }

  if (welcomeText) {
    welcomeText.textContent = t(currentLang, "welcomeText");
  }

  if (videoHint) {
    videoHint.textContent = t(currentLang, "videoHint");
  }
}

async function loadSettings() {
  const settings = await brw.storage.local.get(["theme", "uiLanguage"]);
  // theme.js already applies the stored theme; pick up the saved interface
  // language, or fall back to the browser's own language, then English.
  let lang = settings.uiLanguage;
  if (!lang || !UI_STRINGS[lang]) {
    const browserLang = detectBrowserLanguage();
    lang = UI_STRINGS[browserLang] ? browserLang : "en";
  }
  applyUiLanguage(lang);
}

document.addEventListener("DOMContentLoaded", async () => {
  populateUiLangSelect();
  await loadSettings();
  pageBtn.addEventListener("click", togglePage);
  videoBtn.addEventListener("click", toggleVideo);

  uiLangSelect.addEventListener("change", () => {
    const lang = uiLangSelect.value;
    brw.storage.local.set({ uiLanguage: lang });
    applyUiLanguage(lang);
  });

  await refreshState();

  // Refresh whenever the active tab changes so the sidebar always reflects
  // the mirror state of the tab currently in focus.
  if (brw.tabs && brw.tabs.onActivated) {
    brw.tabs.onActivated.addListener(() => {
      refreshState().catch((err) => console.error("Tab-activated refresh failed:", err));
    });
  }

  // Also refresh when the sidebar becomes visible after being hidden.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshState().catch((err) => console.error("Visibility refresh failed:", err));
    }
  });
});
