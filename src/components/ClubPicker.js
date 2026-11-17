import { h, text } from "../utils/h.js";
import { CLUBS } from "../clubs.js";

// A club's real crest. If the image can't load (offline, blocked) a round badge in the club's own colours stands in,
// so the picker never shows a broken image.
export function ClubCrest(club, size = 44) {
  const fallback = () => h("span", { className: "club-crest-fallback", style: { width: size + "px", height: size + "px", background: `linear-gradient(135deg, ${club.primary} 50%, ${club.secondary} 50%)` }, "aria-hidden": "true" });
  const img = h("img", { className: "club-crest", src: club.logo, alt: "", width: String(size), height: String(size), decoding: "async", referrerpolicy: "no-referrer" });
  img.addEventListener("error", () => img.replaceWith(fallback()), { once: true });
  return img;
}

// The four clubs as a choice.
//   variant "grid": big cards (crest, full name, a tick when chosen), for Appearance and the sign-up step
//   variant "row":  four crests in a line with short names, for the small "which club?" cards
export function ClubTiles({ selectedId = null, onSelect, variant = "grid" }) {
  const row = variant === "row";
  return h("div", { className: row ? "club-chip-row" : "club-card-grid", role: "radiogroup", "aria-label": "Club you support" }, CLUBS.map((club) => {
    const chosen = club.id === selectedId;
    return h("button", {
      type: "button", role: "radio", "aria-checked": String(chosen),
      className: (row ? "club-chip" : "club-card") + (chosen ? " selected" : ""),
      style: { "--club-1": club.primary, "--club-2": club.secondary },
      onClick: () => onSelect(club),
    }, row
      ? [h("span", { className: "club-chip-crest" }, [ClubCrest(club, 46)]), text("span", { className: "club-chip-name" }, club.short)]
      : [h("span", { className: "club-card-crest" }, [ClubCrest(club, 60)]), text("span", { className: "club-card-name" }, club.name),
         h("span", { className: "club-card-check", "aria-hidden": "true" }, [h("i", { "data-lucide": "check" })])]);
  }));
}
