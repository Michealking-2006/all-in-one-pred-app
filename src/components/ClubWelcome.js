import { h } from "../utils/h.js";
import { ClubStep } from "./ClubStep.js";

// The screen someone sees right after signing in (email, Google, anything) when no club is saved on their account:
// the same "Which club do you support?" step as in sign-up, full screen.
export function ClubWelcome({ onChoose, onSkip }) {
  return h("main", { className: "screen auth-screen" }, [
    h("div", { className: "auth-glow", "aria-hidden": "true" }),
    h("div", { className: "auth-topbar" }, [h("span", {})]),
    h("div", { className: "auth-content" }, [ClubStep({ primaryLabel: "Continue", onConfirm: onChoose, onSkip })]),
  ]);
}
