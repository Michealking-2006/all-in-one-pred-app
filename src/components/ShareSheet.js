import { h, text } from "../utils/h.js";
import { generateShareImage, canShareFiles, shareImageFile, downloadImageFile } from "../share/shareImage.js";
import { showToast } from "../toast.js";
import { createSheet } from "./Sheet.js";
import { buildSlug } from "../utils/slug.js";

const TITLES = { match: "Share match", player: "Share player", club: "Share club", venue: "Share venue", league: "Share league" };

// The drawer itself (drag to dismiss, Escape, Back button, focus handling) lives in Sheet.js.
// #share-sheet-root sits outside #root (like #toast-root), so App.js's full re-render on every
// store change can't tear the drawer down mid-generation.

// Our own page for what is being shared, and a one-line caption to go with the picture.
function linkFor(type, data) {
  const id = (n) => (n != null ? n : "");
  switch (type) {
    case "match": return data?.fixture?.id ? `/match/${data.fixture.id}` : "";
    case "player": return data?.player?.id ? `/player/${buildSlug(data.player.id, data.player.name || "player")}` : "";
    case "club": return data?.team?.id ? `/club/${buildSlug(data.team.id, data.team.name || "club")}` : "";
    case "venue": return data?.id ? `/venue/${buildSlug(data.id, data.name || "venue")}` : "";
    case "league": return data?.league?.id ? `/league/${buildSlug(data.league.id, data.league.name || "league")}` : "";
    default: return id("");
  }
}

function captionFor(type, data) {
  if (type === "match") {
    const home = data?.teams?.home?.name, away = data?.teams?.away?.name;
    if (!home || !away) return "Football on Scoutwave";
    const status = data?.fixture?.status?.short;
    const scored = data?.goals?.home != null && data?.goals?.away != null && status && status !== "NS" && status !== "TBD";
    return scored ? `${home} ${data.goals.home}\u2013${data.goals.away} ${away}` : `${home} v ${away}`;
  }
  const name = data?.player?.name || data?.team?.name || data?.name || data?.league?.name;
  return name ? `${name} on Scoutwave` : "Football on Scoutwave";
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

function readyBody(blob, type, sheet, share) {
  const url = URL.createObjectURL(blob);
  const img = h("img", { className: "share-sheet-preview", src: url, alt: "" });

  async function onShare() {
    try {
      await shareImageFile(blob, type, share);
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
  const copy = share.url ? h("button", { type: "button", className: "text-action share-sheet-copy", onClick: async () => {
    try { await navigator.clipboard.writeText(share.url); showToast("Link copied", "success"); } catch { showToast("Couldn't copy the link", "error"); }
  } }, [h("i", { "data-lucide": "link", "aria-hidden": "true" }), text("span", {}, "Copy link")]) : null;

  const body = h("div", { className: "share-sheet-body" }, [img, actions, copy]);
  sheet.setBody(body, () => URL.revokeObjectURL(url)); // released when the drawer is replaced or closed
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
  const sheet = createSheet({ title: TITLES[type] || "Share", label: TITLES[type] || "Share" });
  const path = linkFor(type, data);
  const share = { title: captionFor(type, data), text: captionFor(type, data) + " | Scoutwave", url: path ? location.origin + path : "" };
  function run() {
    sheet.setBody(loadingBody());
    generateShareImage(type, data, extra)
      .then((blob) => { if (!sheet.closed) readyBody(blob, type, sheet, share); })
      .catch((error) => { if (!sheet.closed) sheet.setBody(errorBody(error?.message, run)); });
  }
  run();
}
