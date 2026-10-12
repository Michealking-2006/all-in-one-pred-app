// Restricts a few native mobile-browser behaviors — text selection, the
// long-press callout menu, and pinch/double-tap zoom — to standalone (PWA)
// mode only. A regular browser tab keeps all of these, since they're useful
// there (copying text, zooming in on fine print) and disabling them site-wide
// would make the page worse for anyone just visiting in Safari or Chrome.
function isStandalone() {
  return (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
}

export function initPwaMode() {
  if (!isStandalone()) return;
  document.documentElement.dataset.pwa = "true";

  // Disable pinch- and double-tap zoom by rewriting the viewport meta tag.
  // The static tag in index.html deliberately leaves zoom enabled, since that
  // markup also serves anyone opening the page in an ordinary browser tab.
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && !/user-scalable/.test(viewport.getAttribute("content") || "")) {
    viewport.setAttribute("content", viewport.getAttribute("content") + ", maximum-scale=1, user-scalable=no");
  }

  // The long-press "Open/Copy/Share" callout menu on links and images: the
  // CSS (-webkit-touch-callout, user-select, both keyed off [data-pwa]) covers
  // most of it; the native contextmenu event is the remaining trigger on some
  // browsers/devices.
  document.addEventListener("contextmenu", (event) => event.preventDefault());
}
