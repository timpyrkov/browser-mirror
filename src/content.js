// The panel injects this script again on every refresh or action. Wrapping
// it in a function keeps repeated injections from redeclaring top-level
// constants, and the flag makes them exit before adding a second listener.
(() => {
  if (window.__browserMirrorInstalled) return;
  window.__browserMirrorInstalled = true;

  // API compatibility
  const brw = typeof browser !== "undefined" ? browser : chrome;

  const PAGE_MIRROR_CLASS = "browser-mirror-page";
  const VIDEO_MIRROR_CLASS = "browser-mirror-video";
  const PAGE_STYLE_ID = "browser-mirror-page-style";
  const VIDEO_STYLE_ID = "browser-mirror-video-style";
  const MIRROR_ATTR = "data-browser-mirror";
  const PREV_TRANSFORM_ATTR = "data-browser-mirror-prev-transform";
  const PREV_PRIORITY_ATTR = "data-browser-mirror-prev-priority";

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

  /**
   * LinkedIn post URN from /feed/update/urn:li:{kind}:{id}/ or
   * /posts/[{vanity}_{slug}-]{kind}-{id}-{xxxx}/ (same patterns as the
   * browser-videos LinkedIn gallery), else null.
   */
  function linkedInPostUrn(pathname) {
    let path;
    try {
      path = decodeURIComponent(pathname);
    } catch (error) {
      return null;
    }
    const match = /^\/feed\/update\/urn:li:(activity|ugcPost|share):(\d{10,25})\/?$/.exec(path)
      || /^\/posts\/(?:[^/]*[_-])?(activity|ugcPost|share)-(\d{10,25})-[A-Za-z0-9_-]{2,8}\/?$/.exec(path);
    return match ? `urn:li:${match[1]}:${match[2]}` : null;
  }

  /**
   * Platforms whose main video sits in a known container, using the URL and
   * DOM patterns tested in the sister extensions browser-videos and
   * browser-images. `scopes` lists containers to try in order; the first one
   * holding a visible candidate wins, otherwise detection falls back to the
   * whole page. `media` is what counts as a candidate inside a scope.
   */
  const SITE_RULES = [
    {
      // Shorts keep the neighbouring Shorts rendered above and below.
      host: /(^|\.)youtube\.com$/i,
      path: /^\/shorts\/[A-Za-z0-9_-]{11}\/?$/,
      scopes: () => ["ytd-reel-video-renderer[is-active]", "#shorts-player"],
    },
    {
      // Keeps hover previews and the miniplayer from winning on watch pages.
      host: /(^|\.)youtube\.com$/i,
      path: /^\/watch\/?$/,
      scopes: () => ["#movie_player", "ytd-player"],
    },
    {
      // A post or reel opened from a profile or the feed shows in a modal
      // dialog, with the feed's own videos still playing behind it.
      host: /(^|\.)instagram\.com$/i,
      path: /^\/(?:[A-Za-z0-9._]{1,30}\/)?(?:p|reels?|tv)\/[A-Za-z0-9_-]{5,60}\/?$/,
      scopes: () => ['[role="dialog"]'],
    },
    {
      // The post's own card, by its exact URN: "More posts" cards below it
      // carry other URNs (data-urn/data-id logged in, data-activity-urn and
      // data-attributed-urn on the public page).
      host: /(^|\.)linkedin\.com$/i,
      scopes: (url) => {
        const urn = linkedInPostUrn(url.pathname);
        if (!urn) return [];
        return [`[data-urn="${urn}"], [data-id="${urn}"], [data-activity-urn="${urn}"], [data-attributed-urn="${urn}"]`];
      },
    },
    {
      // The pin closeup, not the "More ideas" grid of autoplaying pins below.
      host: /(^|\.)pinterest\./i,
      path: /\/pin\/\d+/,
      scopes: () => ['[data-test-id="pin-closeup"]', '[data-test-id="closeup"]'],
    },
    {
      // Each artwork item renders in <project-asset>. Clips can also play in
      // an embedded player <iframe> (ArtStation's own or YouTube/Vimeo),
      // which the content script cannot enter, so the iframe itself is
      // mirrored.
      host: /(^|\.)artstation\.com$/i,
      path: /^\/artwork\/[A-Za-z0-9]+\/?$/,
      scopes: () => ["project-asset"],
      media: "video, iframe",
    },
  ];

  function ensurePageStyleInjected() {
    if (document.getElementById(PAGE_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = PAGE_STYLE_ID;
    style.textContent = `.${PAGE_MIRROR_CLASS} { transform: scaleX(-1) !important; }`;
    document.head.appendChild(style);
  }

  /**
   * Injects the video mirror style into the same root (document or shadow DOM)
   * that contains the target element, so the class rule actually applies.
   */
  function ensureVideoStyleInRoot(el) {
    const root = el.getRootNode();
    // Look the style up on the root itself: Document and ShadowRoot both
    // support getElementById, whereas <head> (an Element) does not.
    if (typeof root.getElementById !== "function" || root.getElementById(VIDEO_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = VIDEO_STYLE_ID;
    style.textContent = `.${VIDEO_MIRROR_CLASS} { transform: scaleX(-1) !important; }`;
    // A Document can only contain one element child (<html>), so append styles
    // to <head> instead. ShadowRoots can accept the style directly.
    (root === document ? document.head || document.documentElement : root).appendChild(style);
  }

  /**
   * Returns the area of an element that lies inside the viewport, or 0 when
   * it is off screen (on any side) or hidden.
   */
  function visibleArea(el) {
    const rect = el.getBoundingClientRect();
    const w = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
    const h = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    if (w <= 0 || h <= 0) return 0;
    if (typeof el.checkVisibility === "function"
      && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return 0;
    return w * h;
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
   * Picks the best visible candidate by visible area, with extra weight for
   * videos inside a known YouTube player (so a small preview/ad video does
   * not win) and for a playing video (so a paused neighbour does not win).
   */
  function pickLargestVisible(candidates) {
    let best = null;
    let bestScore = 0;
    for (const el of candidates) {
      const area = visibleArea(el);
      if (area <= 0) continue;
      const playing = el.tagName === "VIDEO" && !el.paused && !el.ended;
      const score = area * (isInsideYouTubePlayer(el) ? 10 : 1) * (playing ? 2 : 1);
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
    return best;
  }

  /** The main video inside the current platform's known containers, else null. */
  function findSiteVideo() {
    const url = new URL(location.href);
    const rule = SITE_RULES.find((r) => r.host.test(url.hostname) && (!r.path || r.path.test(url.pathname)));
    if (!rule) return null;
    for (const selector of rule.scopes(url)) {
      for (const scope of document.querySelectorAll(selector)) {
        const candidates = collectVideos(scope);
        if (rule.media) candidates.push(...scope.querySelectorAll(rule.media));
        const video = pickLargestVisible(candidates);
        if (video) return video;
      }
    }
    return null;
  }

  /**
   * Finds the main visible video element on the page: first inside the
   * platform's known containers (see SITE_RULES), then the best visible
   * <video> anywhere, then common player containers.
   */
  function findMainVideo() {
    return findSiteVideo() || pickLargestVisible(collectVideos()) || findPlayerContainerFallback();
  }

  function findPlayerContainerFallback() {
    for (const selector of VIDEO_CONTAINER_SELECTORS) {
      for (const el of document.querySelectorAll(selector)) {
        if (visibleArea(el) > 0) return el;
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
    if (mirrored) {
      if (isVideoMirrored(video)) return;
      ensureVideoStyleInRoot(video);
      // Remember the site's own inline transform so it can be restored later.
      video.setAttribute(PREV_TRANSFORM_ATTR, video.style.getPropertyValue("transform"));
      video.setAttribute(PREV_PRIORITY_ATTR, video.style.getPropertyPriority("transform"));
      video.classList.add(VIDEO_MIRROR_CLASS);
      video.style.setProperty("transform", "scaleX(-1)", "important");
      video.setAttribute(MIRROR_ATTR, "true");
    } else {
      const prevTransform = video.getAttribute(PREV_TRANSFORM_ATTR);
      video.classList.remove(VIDEO_MIRROR_CLASS);
      if (prevTransform) {
        video.style.setProperty("transform", prevTransform, video.getAttribute(PREV_PRIORITY_ATTR) || "");
      } else {
        video.style.removeProperty("transform");
      }
      video.removeAttribute(MIRROR_ATTR);
      video.removeAttribute(PREV_TRANSFORM_ATTR);
      video.removeAttribute(PREV_PRIORITY_ATTR);
    }
  }

  // Only our own markers count: a site may legitimately set an inline
  // scaleX(-1) transform, and that must not be treated as our mirroring.
  function isVideoMirrored(video) {
    return video.classList.contains(VIDEO_MIRROR_CLASS) || video.getAttribute(MIRROR_ATTR) === "true";
  }

  /**
   * Returns every element this script has mirrored, including those inside
   * open shadow roots.
   */
  function collectMirroredVideos() {
    const mirrored = new Set(collectVideos().filter((el) => isVideoMirrored(el)));
    document.querySelectorAll(`.${VIDEO_MIRROR_CLASS}, [${MIRROR_ATTR}]`).forEach((el) => mirrored.add(el));
    return mirrored;
  }

  /**
   * The panel shows "on" whenever any video is mirrored, so clicking it then
   * restores every mirrored video, even if the main video has since changed
   * (e.g. an ad or a larger player). Otherwise it mirrors the main video.
   */
  function toggleVideoMirror() {
    const mirrored = collectMirroredVideos();
    if (mirrored.size > 0) {
      mirrored.forEach((el) => setVideoMirror(el, false));
      return { mirrored: false, found: !!findMainVideo() };
    }
    const video = findMainVideo();
    if (!video) {
      return { mirrored: false, found: false };
    }
    setVideoMirror(video, true);
    return {
      mirrored: true,
      found: true,
    };
  }

  function resetMirroring() {
    document.body.classList.remove(PAGE_MIRROR_CLASS);
    collectMirroredVideos().forEach((el) => setVideoMirror(el, false));
  }

  function getState() {
    return {
      page: document.body.classList.contains(PAGE_MIRROR_CLASS),
      video: collectMirroredVideos().size > 0,
      videoFound: !!findMainVideo(),
    };
  }

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

    if (message.command === "reset") {
      resetMirroring();
      sendResponse({ status: "success", ...getState() });
      return;
    }

    if (message.command === "get-state") {
      sendResponse({ status: "success", ...getState() });
      return;
    }

    sendResponse({ status: "error", message: `Unknown command: ${message.command}` });
  });
})();
