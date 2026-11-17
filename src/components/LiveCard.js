// The pinned live card: a small glass card above the tab bar showing the starred matches that are being played right
// now (crests, score, minute). Tap a row to open the match; the cross hides it until something scores. It lives in its
// own element outside #root, so screen redraws never touch it. Drawing only: what to show is decided in liveWatch.js.
import { h, text } from "../utils/h.js";

const MAX_ROWS = 3;

export function minuteLabel(fx) {
  const st = fx?.fixture?.status || {};
  if (st.short === "HT") return "HT";
  if (st.short === "BT") return "Break";
  if (st.short === "P") return "Pens";
  if (st.short === "INT") return "Paused";
  if (st.elapsed) return st.elapsed + (st.extra ? "+" + st.extra : "") + "'";
  return "Live";
}

const crest = (team) => h("img", { className: "lc-crest", src: team?.logo || "", alt: "", width: "26", height: "26", decoding: "async", loading: "lazy" });

function row(fx, flashing, onOpen) {
  const home = fx.teams?.home, away = fx.teams?.away;
  const label = `${home?.name || "Home"} ${fx.goals?.home ?? 0}, ${away?.name || "Away"} ${fx.goals?.away ?? 0}, ${minuteLabel(fx)}`;
  return h("button", { type: "button", className: "lc-row" + (flashing ? " flash" : ""), "aria-label": label + ". Open match.", onClick: () => onOpen(fx.fixture.id) }, [
    h("span", { className: "lc-team" }, [crest(home), text("span", { className: "lc-name" }, home?.name || "Home")]),
    h("span", { className: "lc-mid" }, [
      text("strong", { className: "lc-score" }, `${fx.goals?.home ?? 0}\u2013${fx.goals?.away ?? 0}`),
      h("span", { className: "lc-minute" }, [h("span", { className: "lc-live-dot", "aria-hidden": "true" }), text("span", {}, minuteLabel(fx))]),
    ]),
    h("span", { className: "lc-team away" }, [text("span", { className: "lc-name" }, away?.name || "Away"), crest(away)]),
  ]);
}

// rows: live fixtures to show (already filtered and ordered). flashIds: fixtures whose score just changed.
export function drawLiveCard(host, rows, { flashIds = new Set(), onOpen, onHide, onMore }) {
  host.replaceChildren();
  if (!rows.length) return 0;
  const shown = rows.slice(0, MAX_ROWS);
  const more = rows.length - shown.length;
  const card = h("section", { className: "live-card", role: "region", "aria-label": "Live matches you've starred" }, [
    h("div", { className: "lc-rows" }, shown.map((fx) => row(fx, flashIds.has(fx.fixture.id), onOpen))),
    h("button", { type: "button", className: "lc-hide", "aria-label": "Hide live card", onClick: onHide }, [h("i", { "data-lucide": "x" })]),
    more > 0 ? h("button", { type: "button", className: "lc-more", onClick: onMore }, `${more} more live`) : null,
  ]);
  host.appendChild(card);
  return shown.length;
}
