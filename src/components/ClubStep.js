import { h, text } from "../utils/h.js";
import { clubById } from "../clubs.js";
import { previewClub } from "../clubTheme.js";
import { ClubTiles, ClubCrest } from "./ClubPicker.js";

// "Which club do you support?" as a step in the sign-up flow and the first screen after signing in. Picking a club
// recolours the screen on the spot (a preview: nothing is saved until the button is pressed). The caller decides what
// "Continue" and "Skip" do.
//   onConfirm(club)   the person pressed the main button with a club chosen
//   onSkip()          "Skip for now": the colours go back to what they were before the preview
// The returned element has setBusy(true/false) so the caller can show progress while it saves.
export function ClubStep({ initialId = null, primaryLabel = "Continue", onConfirm, onSkip }) {
  let chosen = initialId;
  const hero = h("div", { className: "club-step-hero" });
  const grid = h("div", { className: "club-step-grid" });
  const button = h("button", { type: "button", className: "primary-button", disabled: !chosen }, primaryLabel);
  const skip = h("button", { type: "button", className: "club-step-skip" }, "Skip for now");

  function draw() {
    const club = clubById(chosen);
    hero.replaceChildren(club ? h("span", { className: "club-step-plate" }, [ClubCrest(club, 74)]) : h("span", { className: "club-step-empty" }, [h("i", { "data-lucide": "shield", "aria-hidden": "true" })]));
    grid.replaceChildren(ClubTiles({ selectedId: chosen, onSelect: (picked) => { chosen = picked.id; previewClub(picked); draw(); } }));
    button.disabled = !chosen;
  }
  draw();

  button.addEventListener("click", () => { if (chosen) onConfirm(clubById(chosen)); });
  skip.addEventListener("click", () => { previewClub(clubById(initialId)); onSkip(); });

  const root = h("div", { className: "club-step" }, [
    hero,
    text("h1", { className: "auth-title" }, "Which club do you support?"),
    text("p", { className: "auth-subtitle" }, "Pick yours and Scoutwave wears its colours and crest. You can change it any time in Appearance."),
    grid,
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
