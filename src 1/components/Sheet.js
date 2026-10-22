// A bottom drawer you can drag down to dismiss, used by every drawer in the app.
//   const sheet = createSheet({ title: "Share match", label: "Share match" });
//   sheet.setBody(node, dispose?)   // swap the content (dispose runs when it is replaced or the drawer closes)
//   sheet.close()
// Drag by the handle or the header (mouse, finger or pen), or pull down on the content while it is
// scrolled to the top. Closes on a long drag or a quick flick, springs back otherwise. Also closes on
// Escape, a tap outside, the Close button and the Back button, and keeps keyboard focus inside while open.
import { h, text } from "../utils/h.js";
import { dragOffset, backdropOpacity, shouldDismiss, makeVelocityTracker } from "./sheetDrag.js";

let active = null; // one drawer at a time

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function createSheet({ title = "", label, onClose } = {}) {
  active?.close(true);

  const mount = document.getElementById("share-sheet-root") || document.body;
  const backdrop = h("div", { className: "share-sheet-backdrop" });
  const titleEl = text("strong", {}, title);
  const closeButton = h("button", { type: "button", className: "icon-button", "aria-label": "Close" }, [h("i", { "data-lucide": "x" })]);
  const head = h("header", { className: "share-sheet-head sheet-drag-zone" }, [
    h("span", { className: "sheet-grabber", "aria-hidden": "true" }),
    titleEl,
    closeButton,
  ]);
  const content = h("div", { className: "sheet-content" });
  const card = h("div", { className: "share-sheet-card", role: "dialog", "aria-modal": "true", "aria-label": label || title || "Drawer", tabindex: "-1" }, [head, content]);
  const wrap = h("div", { className: "share-sheet-wrap" }, [backdrop, card]);

  let disposeBody = null, closed = false, historyLive = false;
  const opener = document.activeElement;

  function runDispose() { const d = disposeBody; disposeBody = null; if (d) try { d(); } catch { /* cleanup must never block closing */ } }

  function finish() {
    if (closed) return;
    closed = true;
    runDispose();
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("popstate", onPop);
    document.documentElement.classList.remove("sheet-open");
    wrap.remove();
    if (active === api) active = null;
    if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus({ preventScroll: true });
    onClose?.();
  }

  // Close = go back one history step (so the phone's Back button and the close button agree); the
  // popstate listener then removes the drawer. Without a history entry it just closes.
  function close(immediate = false) {
    if (closed) return;
    if (historyLive && !immediate) { history.back(); return; }
    if (historyLive) { historyLive = false; window.removeEventListener("popstate", onPop); }
    finish();
  }
  function onPop() { if (historyLive) { historyLive = false; animateOut().then(finish); } }

  // Animate off the bottom, then resolve.
  function animateOut() {
    if (reduceMotion() || closed) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => { card.removeEventListener("transitionend", done); resolve(); };
      card.style.transition = "transform .22s cubic-bezier(.4,0,1,1)";
      backdrop.style.transition = "opacity .22s linear";
      card.style.transform = `translateY(${card.offsetHeight}px)`;
      backdrop.style.opacity = "0";
      card.addEventListener("transitionend", done);
      window.setTimeout(done, 280);
    });
  }

  function onKey(event) {
    if (event.key === "Escape") { event.stopPropagation(); close(); return; }
    if (event.key !== "Tab") return;
    const items = [...card.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) { event.preventDefault(); card.focus(); return; }
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === card)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  // ---- dragging -----------------------------------------------------------
  const tracker = makeVelocityTracker();
  let startY = 0, dy = 0, dragging = false;

  function move(y) {
    dy = y - startY;
    tracker.add(y);
    card.style.transition = "none";
    card.style.transform = `translateY(${dragOffset(dy)}px)`;
    backdrop.style.transition = "none";
    backdrop.style.opacity = String(backdropOpacity(dy, card.offsetHeight));
  }
  function release() {
    if (!dragging) return;
    dragging = false;
    const dismiss = shouldDismiss({ dy, height: card.offsetHeight, velocity: tracker.velocity() });
    if (dismiss) { animateOut().then(() => close(true)); return; }
    if (!reduceMotion()) {
      card.style.transition = "transform .28s cubic-bezier(.2,.9,.3,1.2)";
      backdrop.style.transition = "opacity .2s linear";
    }
    card.style.transform = "";
    backdrop.style.opacity = "";
    dy = 0;
  }
  function begin(y) { startY = y; dy = 0; dragging = true; tracker.reset(); tracker.add(y); }

  // Handle and header: pointer events (works for mouse, touch and pen).
  head.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button")) return;
    begin(event.clientY);
    head.setPointerCapture?.(event.pointerId);
  });
  head.addEventListener("pointermove", (event) => { if (dragging) move(event.clientY); });
  head.addEventListener("pointerup", release);
  head.addEventListener("pointercancel", release);

  // Content: pull down while scrolled to the top (touch). A listener that may cancel the scroll is needed.
  let touchY = null;
  content.addEventListener("touchstart", (event) => { touchY = content.scrollTop <= 0 && event.touches.length === 1 ? event.touches[0].clientY : null; }, { passive: true });
  content.addEventListener("touchmove", (event) => {
    if (touchY === null) return;
    const y = event.touches[0].clientY;
    if (!dragging) {
      if (y - touchY > 8 && content.scrollTop <= 0) begin(touchY); else if (y < touchY) { touchY = null; return; } else return;
    }
    event.preventDefault();
    move(y);
  }, { passive: false });
  content.addEventListener("touchend", () => { touchY = null; release(); });
  content.addEventListener("touchcancel", () => { touchY = null; release(); });

  backdrop.addEventListener("click", () => close());
  closeButton.addEventListener("click", () => close());
  document.addEventListener("keydown", onKey, true);

  const api = {
    el: wrap,
    setTitle(value) { titleEl.textContent = value; },
    setBody(node, dispose) { runDispose(); disposeBody = dispose || null; content.replaceChildren(node); },
    close,
    get closed() { return closed; },
  };
  active = api;

  history.pushState({ sheet: true }, "");
  historyLive = true;
  window.addEventListener("popstate", onPop);
  document.documentElement.classList.add("sheet-open");
  mount.appendChild(wrap);
  card.focus({ preventScroll: true });
  return api;
}
