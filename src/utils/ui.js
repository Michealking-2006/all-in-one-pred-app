import { h } from "./h.js";
import { SkeletonSeasonBar } from "../components/Skeleton.js";

// Renders meta text as separate spans (spacing handled by CSS) instead of
// joining strings with middle dots.
export function metaLine(parts, className = "meta-line") {
  return h(
    "div",
    { className },
    parts.filter((p) => p != null && p !== "").map((p) => h("span", {}, String(p)))
  );
}

// Updates a star/favourite button in place, so toggling never needs a full
// app re-render (which would reset scroll position and refetch).
export function setStarState(button, on) {
  button.classList.toggle("selected", on);
  button.setAttribute("aria-label", on ? "Remove favourite" : "Add favourite");
  button.setAttribute("aria-pressed", String(on));
  const svg = button.querySelector("svg");
  if (svg) svg.setAttribute("fill", on ? "currentColor" : "none");
}

// A standalone favourite star button (page headers: match, club, player,
// venue, league). onToggle() must return the new favourite state.
export function favoriteStarButton({ isFavorite, onToggle, className = "icon-button match-star" }) {
  const button = h("button", {
    type: "button",
    className: className + (isFavorite ? " selected" : ""),
    "aria-label": isFavorite ? "Remove favourite" : "Add favourite",
    "aria-pressed": !!isFavorite,
    onClick: () => setStarState(button, onToggle()),
  }, [h("i", { "data-lucide": "star", fill: isFavorite ? "currentColor" : "none" })]);
  return button;
}

// A favourite-list row: image/title/subtitle open the entity, a separate
// sibling star button un-favourites it in place (removing it live, mirroring
// MatchRow's pattern). Two sibling buttons, not one nested inside the other.
export function favoriteEntityRow({ image, title, subtitle, onOpen, isFavorite, onToggleFavorite, round = false }) {
  const star = favoriteStarButton({ isFavorite, onToggle: onToggleFavorite, className: "ios-favorite" });
  return h("article", { className: "fav-row" }, [
    h("button", { type: "button", className: "entity-row", onClick: onOpen }, [
      image ? h("img", { className: "entity-row-image" + (round ? " round" : ""), src: image, alt: "", loading: "lazy" }) : h("span", { className: "entity-row-image" + (round ? " round" : "") }),
      h("span", { className: "entity-row-copy" }, [
        h("span", { className: "entity-row-title" }, String(title ?? "")),
        subtitle ? h("span", { className: "entity-row-sub" }, String(subtitle)) : null,
      ]),
      h("i", { "data-lucide": "chevron-right", className: "profile-chevron" }),
    ]),
    star,
  ]);
}

// A tappable list row: image, title, optional subtitle, optional trailing node.
// `round` crops the image to a circle (people); crests stay square (clubs).
export function entityRow({ image, title, subtitle, trailing = null, onClick, round = false, chevron = true }) {
  const tag = onClick ? "button" : "div";
  const props = { className: "entity-row" + (onClick ? "" : " static") };
  if (onClick) { props.type = "button"; props.onClick = onClick; }
  return h(tag, props, [
    image ? h("img", { className: "entity-row-image" + (round ? " round" : ""), src: image, alt: "", loading: "lazy" }) : h("span", { className: "entity-row-image" + (round ? " round" : "") }),
    h("span", { className: "entity-row-copy" }, [
      h("span", { className: "entity-row-title" }, String(title ?? "")),
      subtitle ? h("span", { className: "entity-row-sub" }, String(subtitle)) : null,
    ]),
    trailing,
    onClick && chevron ? h("i", { "data-lucide": "chevron-right", className: "profile-chevron" }) : null,
  ]);
}

export function entityList(rows) {
  const items = rows.filter(Boolean);
  return items.length ? h("div", { className: "entity-list" }, items) : null;
}

// Local segmented control. options: [{ id, label }]. Calls onChange(id) on tap.
export function segmented(options, onChange, initial = options[0].id) {
  const buttons = options.map((option) =>
    h("button", { type: "button", "data-id": option.id, className: option.id === initial ? "active" : "", "aria-pressed": option.id === initial, onClick: () => select(option.id) }, option.label)
  );
  const node = h("div", { className: "seg", role: "group" }, buttons);
  function select(id) {
    buttons.forEach((button) => {
      const on = button.dataset.id === id;
      button.classList.toggle("active", on);
      button.setAttribute("aria-pressed", String(on));
    });
    onChange(id);
  }
  return { node, select };
}

// Placeholder that shows a skeleton season bar while the list of seasons loads,
// then either the real picker (show) or nothing at all (hide) — so the page never
// jumps when the bar appears.
export function seasonSlot() {
  const node = h("div", { className: "season-slot" }, [SkeletonSeasonBar()]);
  return {
    node,
    show(picker) { node.hidden = false; node.replaceChildren(picker); },
    hide() { node.replaceChildren(); node.hidden = true; },
  };
}

// "Season  2025/26 v" row for pages whose data depends on a season.
// options: [{ value, label }]. Calls onChange(value) with the chosen value.
export function seasonPicker({ options, value, onChange, label = "Season" }) {
  const select = h("select", { "aria-label": label }, options.map((option) => h("option", { value: String(option.value) }, option.label)));
  select.value = String(value);
  select.addEventListener("change", () => onChange(select.value));
  return h("div", { className: "season-bar" }, [h("span", { className: "season-bar-label" }, label), select]);
}

// Horizontally scrolling pills (many options, e.g. competitions).
export function pills(options, onChange, initial = options[0]?.id) {
  const buttons = options.map((option) =>
    h("button", { type: "button", "data-id": option.id, className: "pill" + (option.id === initial ? " active" : ""), "aria-pressed": option.id === initial, onClick: () => select(option.id) }, option.label)
  );
  const node = h("div", { className: "pill-row", role: "group" }, buttons);
  function select(id) {
    buttons.forEach((button) => {
      const on = button.dataset.id === id;
      button.classList.toggle("active", on);
      button.setAttribute("aria-pressed", String(on));
    });
    onChange(id);
  }
  return { node, select };
}
