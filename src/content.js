// API compatibility
const brw = typeof browser !== "undefined" ? browser : chrome;

const PAGE_MIRROR_CLASS = "browser-mirror-page";
const VIDEO_MIRROR_CLASS = "browser-mirror-video";
const STYLE_ID = "browser-mirror-style";

const VIDEO_CONTAINER_SELECTORS = [
  // Generic players
  "video",
  // YouTube
  "#movie_player",
  "ytd-player",
  ".html5-video-player",
  ".html5-main-video",
  // Vimeo / Netflix / common wrappers
  ".player",
  ".video-player",
  ".vp-video",
  ".WatchVideo-screen",
];

function ensurePageStyleInjected() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `.${PAGE_MIRROR_CLASS} { transform: scaleX(-1) !important; }`;
  document.head.appendChild(style);
}

/**
 * Injects the video mirror style into the same root (document or shadow DOM)
 * that contains the target element, so the class rule actually applies.
 */
function ensureVideoStyleInRoot(el) {
  const root = el.getRootNode();
  if (root.getElementById && root.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `.${VIDEO_MIRROR_CLASS} { transform: scaleX(-1) !important; }`;
  root.appendChild(style);
}

/**
 * Returns the visible bounding rectangle area of an element.
 */
function visibleArea(el) {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return 0;
  const w = Math.min(rect.width, window.innerWidth - Math.max(0, rect.left));
  const h = Math.min(rect.height, window.innerHeight - Math.max(0, rect.top));
  return Math.max(0, w) * Math.max(0, h);
}

/**
 * Collects all <video> elements, including those nested inside open shadow roots.
 */
function collectVideos(root = document, seen = new Set()) {
  if (seen.has(root)) return [];
  seen.add(root);

  const videos = Array.from(root.querySelectorAll("video"));

  const containers = root.querySelectorAll("*");
  for (const container of containers) {
    if (container.shadowRoot) {
      videos.push(...collectVideos(container.shadowRoot, seen));
    }
  }

  return videos;
}

/**
 * Finds the main visible video element on the page.
 * Prefers actual <video> elements by visible area, then falls back to
 * common video-player container selectors.
 */
function findMainVideo() {
  const videos = collectVideos();
  const visibleVideos = videos
    .map((el) => ({ el, area: visibleArea(el) }))
    .filter((item) => item.area > 0)
    .sort((a, b) => b.area - a.area);

  if (visibleVideos.length > 0) {
    return visibleVideos[0].el;
  }

  // Fallback to known player containers if no real <video> is visible.
  for (const selector of VIDEO_CONTAINER_SELECTORS) {
    const el = document.querySelector(selector);
    if (el && visibleArea(el) > 0) {
      return el;
    }
  }

  return null;
}

function togglePageMirror() {
  ensurePageStyleInjected();
  document.body.classList.toggle(PAGE_MIRROR_CLASS);
  return document.body.classList.contains(PAGE_MIRROR_CLASS);
}

function toggleVideoMirror() {
  const video = findMainVideo();
  if (!video) {
    return { mirrored: false, found: false };
  }
  ensureVideoStyleInRoot(video);
  video.classList.toggle(VIDEO_MIRROR_CLASS);
  return {
    mirrored: video.classList.contains(VIDEO_MIRROR_CLASS),
    found: true,
  };
}

function getState() {
  const anyMirroredVideo = collectVideos().some((el) =>
    el.classList.contains(VIDEO_MIRROR_CLASS)
  );
  return {
    page: document.body.classList.contains(PAGE_MIRROR_CLASS),
    video: anyMirroredVideo,
    videoFound: !!findMainVideo(),
  };
}

if (typeof window.__browserMirrorInstalled === "undefined") {
  window.__browserMirrorInstalled = true;

  brw.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === "toggle-page") {
      const mirrored = togglePageMirror();
      sendResponse({ status: "success", page: mirrored, video: getState().video });
      return;
    }

    if (message.command === "toggle-video") {
      const result = toggleVideoMirror();
      const state = getState();
      sendResponse({
        status: "success",
        page: state.page,
        video: result.mirrored,
        videoFound: result.found,
      });
      return;
    }

    if (message.command === "get-state") {
      sendResponse({ status: "success", ...getState() });
      return;
    }

    sendResponse({ status: "error", message: `Unknown command: ${message.command}` });
  });
}
