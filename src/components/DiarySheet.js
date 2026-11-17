// The drawer for adding a match to the diary (or editing/removing its entry): was there / watched it, a star rating,
// a short note. Opened from the match page and from the diary.
import { h, text } from "../utils/h.js";
import { createSheet } from "./Sheet.js";
import { showToast } from "../toast.js";
import { snapshotOf, entryFor, saveEntry, removeEntry, KINDS } from "../diary.js";

const LABEL = { attended: "I was there", watched: "I watched it" };

export function openDiarySheet(fx, { onChange } = {}) {
  const id = fx?.fixture?.id;
  if (!id) return null;
  const existing = entryFor(id);
  const draft = { kind: existing?.kind || "watched", rating: existing?.rating || 0, note: existing?.note || "" };
  const snap = existing?.match || snapshotOf(fx);
  const sheet = createSheet({ title: existing ? "Edit diary entry" : "Add to diary", label: "Match diary" });

  const kindButtons = KINDS.map((kind) => h("button", { type: "button", className: "diary-kind" + (draft.kind === kind ? " active" : ""), "aria-pressed": draft.kind === kind, onClick: () => { draft.kind = kind; paintKind(); } }, LABEL[kind]));
  const paintKind = () => kindButtons.forEach((b, i) => { const on = KINDS[i] === draft.kind; b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); });

  const stars = [1, 2, 3, 4, 5].map((n) => h("button", { type: "button", className: "diary-star", "aria-label": n + (n === 1 ? " star" : " stars"), onClick: () => { draft.rating = draft.rating === n ? 0 : n; paintStars(); } }, "\u2605"));
  const paintStars = () => stars.forEach((b, i) => { const on = i < draft.rating; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });

  const counter = text("span", { className: "diary-count" }, "");
  const note = h("textarea", { className: "diary-note", maxlength: "500", rows: "4", placeholder: "What do you remember? Who played well, the atmosphere, who you went with\u2026", "aria-label": "Note" });
  note.value = draft.note;
  const count = () => { counter.textContent = note.value.length + "/500"; };
  note.addEventListener("input", () => { draft.note = note.value; count(); });
  count(); paintStars();

  const save = h("button", { type: "button", className: "primary-button", onClick: () => {
    const saved = saveEntry({ id, kind: draft.kind, rating: draft.rating, note: draft.note, match: snap, at: existing?.at });
    if (!saved) { showToast("Couldn't save: this device's storage is full or blocked.", "error"); return; }
    showToast(existing ? "Diary entry updated" : "Added to your diary", "success");
    sheet.close(); onChange?.();
  } }, existing ? "Save changes" : "Save to diary");
  const remove = existing ? h("button", { type: "button", className: "secondary-button", onClick: () => { removeEntry(id); showToast("Removed from your diary", "success"); sheet.close(); onChange?.(); } }, "Remove") : null;

  sheet.setBody(h("div", { className: "diary-sheet" }, [
    h("div", { className: "diary-sheet-match" }, [
      snap.home.logo ? h("img", { src: snap.home.logo, alt: "", width: "32", height: "32" }) : null,
      text("strong", {}, `${snap.home.name || "Home"} ${snap.goals.home ?? "\u2013"}\u2013${snap.goals.away ?? "\u2013"} ${snap.away.name || "Away"}`),
      snap.away.logo ? h("img", { src: snap.away.logo, alt: "", width: "32", height: "32" }) : null,
    ]),
    h("div", { className: "diary-kinds", role: "group", "aria-label": "How you saw it" }, kindButtons),
    h("div", { className: "diary-stars", role: "group", "aria-label": "Your rating" }, stars),
    note, counter,
    h("div", { className: "diary-actions" }, [save, remove]),
  ]));
  return sheet;
}
