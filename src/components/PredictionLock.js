// What a person sees where a pick is locked: how to get it. Premium unlocks every pick; coins unlock one
// match (the server charges the price and decides the balance; the app only asks).
import { h, text } from "../utils/h.js";
import { store } from "../store.js";
import { isFeatureOn } from "../features.js";
import { navigate } from "../router.js";
import { spendCoins, tipCost } from "../entitlements.js";
import { showToast } from "../toast.js";

export function predictionLock(fixtureId) {
  const state = store.getState();
  const accounts = isFeatureOn("serverEntitlements");
  const premium = h("button", { type: "button", className: "primary-button pred-lock-button", onClick: () => navigate("/premium") }, [h("i", { "data-lucide": "gem", "aria-hidden": "true" }), text("span", {}, "Get Premium")]);

  // Accounts off: the demo. Premium is the only door.
  if (!accounts) return h("div", { className: "pred-lock-actions" }, [premium]);

  // Accounts on but nobody signed in: the pick can only be unlocked on an account.
  if (!state.authUser) {
    return h("div", { className: "pred-lock-actions" }, [
      h("button", { type: "button", className: "primary-button pred-lock-button", onClick: () => navigate("/auth/login") }, [h("i", { "data-lucide": "lock", "aria-hidden": "true" }), text("span", {}, "Sign in to unlock")]),
    ]);
  }

  const cost = tipCost();
  const affordable = state.coins >= cost;
  const coins = h("button", {
    type: "button", className: "secondary-button pred-lock-button",
    onClick: async (event) => {
      const button = event.currentTarget;
      if (!affordable) { navigate("/coins"); return; }
      button.disabled = true;
      try { await spendCoins("tip:" + fixtureId); showToast("Pick unlocked", "success"); } // the screen rebuilds with the pick
      catch (error) { button.disabled = false; showToast(error.message || "Couldn't unlock that pick", "error"); }
    },
  }, [h("i", { "data-lucide": "coins", "aria-hidden": "true" }), text("span", {}, affordable ? `Unlock for ${cost} coins` : "Get coins to unlock")]);
  return h("div", { className: "pred-lock-actions" }, [premium, coins]);
}
