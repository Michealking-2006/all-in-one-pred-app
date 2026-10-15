import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { FX_THEMES, fxEntitled, attachFx } from "../themeFx.js";

const PREVIEW_TABS = [["games", "Games"], ["sparkles", "VIP"], ["trophy", "Leagues"], ["user-round", "Profile"]];

// A live miniature of the tab bar. Press and glide across it to play with the
// effect, tap an item to slide the glass lens, whether or not the theme is unlocked.
function preview(theme) {
  const lens = h("span", { className: "nav-lens", "aria-hidden": "true" });
  lens.style.setProperty("--i", "0");
  const layer = h("span", { className: "nav-fx", "aria-hidden": "true" });
  const items = PREVIEW_TABS.map(([icon, label], i) =>
    h("div", { className: "bottom-nav-item fx-preview-item" + (i === 0 ? " active" : "") }, [h("i", { "data-lucide": icon }), text("span", {}, label)])
  );
  const bar = h("div", { className: "fx-preview-bar", "aria-hidden": "true" }, [lens, layer, ...items]);

  let current = 0;
  bar.addEventListener("pointerdown", (event) => {
    const rect = bar.getBoundingClientRect();
    const next = Math.max(0, Math.min(3, Math.floor(((event.clientX - rect.left - 6) / Math.max(1, rect.width - 12)) * 4)));
    if (next === current) return;
    items[current].classList.remove("active");
    items[next].classList.add("active");
    current = next;
    lens.classList.add("moving");
    lens.style.setProperty("--i", String(next));
    setTimeout(() => lens.classList.remove("moving"), 650);
  });
  attachFx(bar, layer, () => theme.id, { ambientMs: 750 });
  return h("div", { className: "fx-preview", "data-fx-scope": theme.id }, [bar]);
}

function actionFor(theme, owned, isActive, props) {
  if (isActive) return h("span", { className: "fx-status" }, [h("i", { "data-lucide": "check" }), text("span", {}, "Active")]);
  if (owned) return h("button", { type: "button", className: "primary-button fx-action", onClick: () => props.onApply(theme.id) }, "Apply");
  if (theme.vip) {
    return h("button", { type: "button", className: "primary-button fx-action", onClick: props.onOpenPremium }, [h("i", { "data-lucide": "gem" }), text("span", {}, "Get Premium")]);
  }
  return h("button", { type: "button", className: "primary-button fx-action", onClick: () => props.onUnlock(theme.id) }, [
    h("i", { "data-lucide": "lock" }),
    text("span", {}, "Unlock \u00b7 " + theme.price),
    h("i", { "data-lucide": "coins" }),
  ]);
}

function card(theme, props) {
  const owned = fxEntitled({ isVip: props.isVip, unlockedThemes: props.unlocked }, theme.id);
  const isActive = owned && props.active === theme.id;
  const short = !owned && !theme.vip && props.coins < theme.price;
  return h("article", { className: "card fx-card" + (owned ? "" : " is-locked") }, [
    preview(theme),
    h("div", { className: "fx-card-body" }, [
      h("div", { className: "fx-card-copy" }, [
        h("div", { className: "fx-card-title" }, [
          h("i", { "data-lucide": theme.icon, "aria-hidden": "true" }),
          text("strong", {}, theme.name),
          theme.vip ? text("span", { className: "fx-chip" }, "Premium") : owned ? null : text("span", { className: "fx-chip" }, "Locked"),
        ]),
        text("p", {}, theme.blurb),
        short ? text("small", { className: "fx-need" }, "You have " + props.coins + " coins. " + (theme.price - props.coins) + " more needed.") : null,
      ]),
      actionFor(theme, owned, isActive, props),
    ]),
  ]);
}

export function ThemesScreen(props) {
  const standardOn = !props.active;
  return h("main", { className: "screen themes-screen" }, [
    PageHeader({ title: "Advanced themes", onBack: props.onBack }),
    h("section", { className: "settings-intro" }, [
      text("span", { className: "section-kicker" }, "Liquid glass"),
      text("h1", {}, "Make the app come alive."),
      text("p", {}, "A theme restyles the whole app: animated backdrop, glass cards and headers, themed buttons and tap effects, plus the bottom bar. Press and glide across a preview to try it."),
    ]),
    h("button", { type: "button", className: "fx-balance", onClick: props.onOpenCoins }, [
      h("i", { "data-lucide": "coins" }),
      text("span", {}, "Your coins"),
      text("strong", { className: "mono" }, props.coins),
      h("i", { "data-lucide": "chevron-right", className: "profile-chevron" }),
    ]),
    h("section", { className: "selection-list card" }, [
      h("button", { type: "button", className: "selection-row appearance-row", onClick: () => props.onApply(null) }, [
        h("i", { "data-lucide": "smartphone" }),
        h("span", { className: "appearance-copy" }, [text("span", {}, "Standard"), text("small", {}, "The default Scoutwave tab bar")]),
        standardOn ? h("i", { "data-lucide": "check" }) : null,
      ]),
    ]),
    h("div", { className: "fx-list" }, FX_THEMES.map((theme) => card(theme, props))),
    text("p", { className: "screen-note" }, "Coin themes are yours once unlocked. Water comes with Premium, along with the verified badge. Animations pause if your device is set to reduce motion, and they use more battery than the standard look."),
  ]);
}
