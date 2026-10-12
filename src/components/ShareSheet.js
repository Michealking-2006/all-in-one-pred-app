import { h, text } from "../utils/h.js";
import { generateShareImage, canShareFiles, shareImageFile, downloadImageFile } from "../share/shareImage.js";
import { showToast } from "../toast.js";

const TITLES = { match: "Share match", player: "Share player", club: "Share club", venue: "Share venue", league: "Share league" };

// #share-sheet-root lives outside #root (like #toast-root), so App.js's full
// re-render on every store change can't tear the sheet down mid-generation.
let root = null;
let closeOnPop = false; // true while the history entry pushed by open() is live

function ensureRoot() {
  if (root) return root;
  root = h("div", { className: "share-sheet-root" });
  document.getElementById("share-sheet-root").appendChild(root);
  window.addEventListener("popstate", () => { if (closeOnPop) { closeOnPop = false; render(null); } });
  return root;
}

function render(content) {
  const mount = ensureRoot();
  mount.replaceChildren();
  if (content) mount.appendChild(content);
}

function closeSheet() {
  // Important: closeOnPop must stay true here — history.back() triggers the
  // popstate handler above asynchronously, and that handler is what actually
  // resets the flag and clears the sheet. Resetting it here first meant the
  // handler's own check always saw it as already-false and never fired.
  if (closeOnPop) {
    history.back();
  } else {
    render(null);
  }
}

function sheetShell(type, body) {
  const backdrop = h("div", { className: "share-sheet-backdrop", onClick: closeSheet });
  const card = h("div", { className: "share-sheet-card", role: "dialog", "aria-modal": "true", "aria-label": TITLES[type] || "Share" }, [
    h("header", { className: "share-sheet-head" }, [
      text("strong", {}, TITLES[type] || "Share"),
      h("button", { type: "button", className: "icon-button", "aria-label": "Close", onClick: closeSheet }, [h("i", { "data-lucide": "x" })]),
    ]),
    body,
  ]);
  // Stop a tap on the card itself from bubbling to the backdrop and closing it.
  card.addEventListener("click", (event) => event.stopPropagation());
  return h("div", { className: "share-sheet-wrap" }, [backdrop, card]);
}

function loadingBody() {
  return h("div", { className: "share-sheet-body share-sheet-loading" }, [
    h("span", { className: "spinner share-sheet-spinner", "aria-hidden": "true" }),
    text("p", {}, "Preparing your image\u2026"),
  ]);
}

function errorBody(message, onRetry) {
  return h("div", { className: "share-sheet-body share-sheet-error" }, [
    h("i", { "data-lucide": "circle-alert", "aria-hidden": "true" }),
    text("p", {}, message || "Couldn't create the image. Check your connection and try again."),
    h("button", { type: "button", className: "secondary-button", onClick: onRetry }, "Try again"),
  ]);
}

function readyBody(blob, type) {
  const url = URL.createObjectURL(blob);
  const img = h("img", { className: "share-sheet-preview", src: url, alt: "" });

  async function onShare() {
    try {
      await shareImageFile(blob, type);
    } catch (error) {
      if (error?.name !== "AbortError") showToast("Couldn't open the share sheet. Try downloading instead.", "error");
    }
  }
  function onDownload() {
    downloadImageFile(blob, type);
    showToast("Image saved", "success");
  }

  const actions = h("div", { className: "share-sheet-actions" }, [
    canShareFiles() ? h("button", { type: "button", className: "primary-button", onClick: onShare }, [h("i", { "data-lucide": "share-2" }), text("span", {}, "Share")]) : null,
    h("button", { type: "button", className: canShareFiles() ? "secondary-button" : "primary-button", onClick: onDownload }, [h("i", { "data-lucide": "download" }), text("span", {}, "Download")]),
  ]);

  const body = h("div", { className: "share-sheet-body" }, [img, actions]);
  // Release the object URL once this body is no longer in the document
  // (sheet closed/replaced) — a MutationObserver on the root catches both
  // "replaced by new content" and "removed entirely".
  new MutationObserver((_, observer) => {
    if (!body.isConnected) { URL.revokeObjectURL(url); observer.disconnect(); }
  }).observe(ensureRoot(), { childList: true, subtree: true });

  return body;
}

// A standalone header share button (pairs with utils/ui.js's
// favoriteStarButton via headerActions). data/extra: see openShareSheet below.
export function shareButton(type, data, extra) {
  return h("button", { type: "button", className: "icon-button share-header-button", "aria-label": TITLES[type] || "Share", onClick: () => openShareSheet(type, data, extra) }, [
    h("i", { "data-lucide": "share-2" }),
  ]);
}

// data/extra: whatever the calling page already has in memory for this
// entity — see src/share/cards.js for the exact shape each type expects.
// Never fetches anything itself, so opening the sheet never costs an API call
// beyond what the page already made to render itself.
export function openShareSheet(type, data, extra) {
  history.pushState({ shareSheet: true }, "");
  closeOnPop = true;

  function run() {
    render(sheetShell(type, loadingBody()));
    generateShareImage(type, data, extra)
      .then((blob) => render(sheetShell(type, readyBody(blob, type))))
      .catch((error) => render(sheetShell(type, errorBody(error?.message, run))));
  }
  run();
}
