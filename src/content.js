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

const YOUTUBE_PLAYER_IDS = new Set(["ytd-player", "movie_player", "movie-player"]);
const YOUTUBE_PLAYER_CLASSES = new Set(["html5-video-player", "html5-main-video"]);

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
  let root = el.getRootNode();
  // A Document can only contain one element child (<html>), so append styles
  // to <head> instead. ShadowRoots can accept the style directly.
  if (root === document) {
    root = document.head;
  }
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
 * Walks up through shadow hosts to determine whether an element lives inside
 * a known YouTube player container (ytd-player, #movie_player, etc.).
 */
function isInsideYouTubePlayer(el) {
  let node = el;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const id = node.id || "";
      if (YOUTUBE_PLAYER_IDS.has(id.toLowerCase())) return true;
      const cls = (node.className && typeof node.className === "string" ? node.className : "").toLowerCase();
      for (const c of YOUTUBE_PLAYER_CLASSES) {
        if (cls.includes(c)) return true;
      }
    }
    const root = node.getRootNode();
    node = root && root.host ? root.host : null;
  }
  return false;
}

/**
 * Finds the main visible video element on the page.
 * Prefers actual <video> elements by visible area, with extra weight for
 * videos that live inside a known YouTube player so we don't accidentally
 * target a small preview/ad video. Falls back to common player containers.
 */
function findMainVideo() {
  const videos = collectVideos();
  if (videos.length === 0) {
    return findPlayerContainerFallback();
  }

  const scored = videos
    .filter((el) => visibleArea(el) > 0)
    .map((el) => {
      const area = visibleArea(el);
      // Boost videos inside a YouTube player so they win over previews/ads.
      const boost = isInsideYouTubePlayer(el) ? 10 : 1;
      return { el, score: area * boost };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored[0].el;
  }

  return findPlayerContainerFallback();
}

function findPlayerContainerFallback() {
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

function setVideoMirror(video, mirrored) {
  ensureVideoStyleInRoot(video);
  if (mirrored) {
    video.classList.add(VIDEO_MIRROR_CLASS);
    video.style.setProperty("transform", "scaleX(-1)", "important");
    video.setAttribute("data-browser-mirror", "true");
  } else {
    video.classList.remove(VIDEO_MIRROR_CLASS);
    video.style.removeProperty("transform");
    video.removeAttribute("data-browser-mirror");
  }
}

function isVideoMirrored(video) {
  return (
    video.classList.contains(VIDEO_MIRROR_CLASS) ||
    video.getAttribute("data-browser-mirror") === "true" ||
    video.style.transform === "scaleX(-1)"
  );
}

function toggleVideoMirror() {
  const video = findMainVideo();
  if (!video) {
    return { mirrored: false, found: false };
  }
  const nextState = !isVideoMirrored(video);
  setVideoMirror(video, nextState);
  return {
    mirrored: nextState,
    found: true,
  };
}

function getState() {
  const anyMirroredVideo = collectVideos().some((el) => isVideoMirrored(el));
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
