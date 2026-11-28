import { h, text } from "../utils/h.js";
import { CLUBS, clubById, clubFromSaved } from "../clubs.js";
import { previewClub } from "../clubTheme.js";
import { ClubCrest } from "./ClubPicker.js";
import { ClubSearch } from "./ClubSearch.js";

// "Which club do you support?" as a step in the sign-up flow and the first screen after signing in. Picking a club
// recolours the screen on the spot (a preview: nothing is saved until the button is pressed). The caller decides what
// "Continue" and "Skip" do.
//   onConfirm(club)   the person pressed the main button with a club chosen
//   onSkip()          "Skip for now": the colours go back to what they were before the preview
// The returned element has setBusy(true/false) so the caller can show progress while it saves.
//
// Each card is tinted with its club's colours and carries a kit stripe (primary | secondary) along the bottom, which
// also tells the two blue-and-gold clubs apart. Choosing a card updates the cards in place (the grid is never rebuilt, so
// keyboard focus stays where it was) and the crest above pops in on a halo in the club's colour.
export function ClubStep({ initialId = null, initialSaved = null, primaryLabel = "Continue", onConfirm, onSkip }) {
  // `chosen` is the club object (one of the four, or any club found by search). initialSaved: state.clubTheme.
  const initial = clubFromSaved(initialSaved) || clubById(initialId);
  let chosen = initial;
  const hero = h("div", { className: "club-step-hero" });
  const button = h("button", { type: "button", className: "primary-button", disabled: !chosen }, primaryLabel);
  const picked = h("div", { className: "club-step-picked" });
  const skip = h("button", { type: "button", className: "club-step-skip" }, "Skip for now");

  const cards = new Map();
  const grid = h("div", { className: "club-step-grid club-card-grid", role: "radiogroup", "aria-label": "Club you support" }, CLUBS.map((club, i) => {
    const card = h("button", {
      type: "button", role: "radio",
      style: { "--club-1": club.primary, "--club-2": club.secondary, "--i": String(i) },
      onClick: () => { chosen = club; previewClub(club); paint(); },
    }, [
      h("span", { className: "club-card-crest" }, [ClubCrest(club, 60)]),
      text("span", { className: "club-card-name" }, club.name),
      text("span", { className: "club-card-motto" }, club.motto),
      h("span", { className: "club-card-check", "aria-hidden": "true" }, [h("i", { "data-lucide": "check" })]),
    ]);
    cards.set(club.id, card);
    return card;
  }));

  function paint() {
    const club = chosen;
    for (const [id, card] of cards) {
      const on = id === chosen?.id;
      card.className = "club-card" + (on ? " selected" : "");
      card.setAttribute("aria-checked", String(on));
    }
    grid.className = "club-step-grid club-card-grid" + (club ? " has-choice" : "");
    hero.replaceChildren(club
      ? h("span", { className: "club-step-plate", style: { "--club-1": club.primary } }, [ClubCrest(club, 84)])
      : h("span", { className: "club-step-brand" }, [h("img", { src: "/src/assets/scoutwave-mark-white.png", alt: "", width: "56", height: "56" })]));
    // A club found by search is shown here, ticked, since it has no card in the grid.
    picked.replaceChildren(...(club?.custom ? [h("div", { className: "club-card selected club-picked-card", style: { "--club-1": club.primary, "--club-2": club.secondary } }, [
      h("span", { className: "club-picked-crest" }, [ClubCrest(club, 44)]),
      h("span", { className: "club-picked-copy" }, [text("span", { className: "club-card-name" }, club.name), club.motto ? text("span", { className: "club-card-motto" }, club.motto) : null]),
      h("span", { className: "club-card-check", "aria-hidden": "true" }, [h("i", { "data-lucide": "check" })]),
    ])] : []));
    button.disabled = !chosen;
  }
  paint();

  button.addEventListener("click", () => { if (chosen) onConfirm(chosen); });
  skip.addEventListener("click", () => { previewClub(initial); onSkip(); });

  const root = h("div", { className: "club-step" }, [
    hero,
    text("h1", { className: "auth-title" }, "Which club do you support?"),
    text("p", { className: "auth-subtitle" }, "Pick yours and Scoutwave wears its colours and crest. You can change it any time in Appearance."),
    grid,
    picked,
    ClubSearch({ selectedId: () => chosen?.id, onPick: (club) => { chosen = club; previewClub(club); paint(); } }),
    h("div", { className: "club-step-actions" }, [button, skip]),
  ]);
  root.setBusy = (busy) => {
    button.disabled = busy || !chosen;
    skip.disabled = busy;
    button.classList.toggle("is-loading", busy);
    button.replaceChildren(busy ? h("span", { className: "spinner", "aria-hidden": "true" }) : document.createTextNode(primaryLabel));
  };
  return root;
}
