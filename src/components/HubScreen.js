// Transfers & injuries: for the club you support and the clubs you've starred, who has joined or left, who is injured,
// and the news about both. Reached from Profile and from the News screen.
import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { store } from "../store.js";
import { navigate } from "../router.js";
import { entityRow, entityList, segmented, pills } from "../utils/ui.js";
import { safeMessage } from "../utils/errors.js";
import { hubClubs, loadTransfers, loadInjuries } from "../hub.js";

const fmtDate = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); };
const note = (message, cls = "muted-copy") => text("p", { className: cls + " hub-note" }, message);

function newsBlock(articles, itemCard) {
  if (!articles.length) return null;
  return h("section", { className: "hub-news" }, [text("div", { className: "profile-section-label" }, "In the news"), h("div", { className: "news-list" }, articles.map((a) => itemCard(a, (tag) => navigate("/news?tag=" + tag))))]);
}

export function HubScreen({ onBack }) {
  const body = h("div", { className: "hub-body" });
  const root = h("main", { className: "screen hub-screen" }, [PageHeader({ title: "Transfers & injuries", onBack }), body]);
  let clubs = [], club = null, tab = "transfers", token = 0;

  const itemCardPromise = import("./NewsScreen.js").then((m) => m.itemCard);

  async function drawTab() {
    const mine = ++token;
    const panel = body.querySelector(".hub-panel");
    panel.replaceChildren(note("Loading\u2026"));
    try {
      const itemCard = await itemCardPromise;
      const data = tab === "transfers" ? await loadTransfers(club) : await loadInjuries(club);
      if (mine !== token) return;
      panel.replaceChildren();
      if (data.failed) panel.appendChild(note("Couldn't load this right now. Check your connection and try again.", "async-error-state"));
      else if (tab === "transfers") {
        const rows = data.moves.map((m) => entityRow({ image: m.other.logo, title: m.name, subtitle: (m.direction === "in" ? "Joined from " : "Left for ") + (m.other.name || "another club") + ", " + fmtDate(m.date), trailing: text("span", { className: "profile-trailing hub-fee" + (m.direction === "in" ? " in" : " out") }, m.fee), onClick: () => navigate("/player/" + m.playerId), chevron: false }));
        panel.appendChild(entityList(rows) || note("No transfers for " + club.name + " in the last 12 months."));
      } else {
        const rows = data.out.map((p) => entityRow({ image: p.photo, round: true, title: p.name, subtitle: p.reason, trailing: text("span", { className: "hub-badge " + (p.out ? "out" : "doubt") }, p.out ? "Out" : "Doubtful"), onClick: () => navigate("/player/" + p.playerId), chevron: false }));
        panel.appendChild(entityList(rows) || note("No injuries reported for " + club.name + " right now."));
      }
      const news = newsBlock(data.news, itemCard);
      if (news) panel.appendChild(news);
    } catch (error) { if (mine === token) panel.replaceChildren(note(safeMessage(error, "Couldn't load this right now."), "async-error-state")); }
  }

  function drawPage() {
    body.replaceChildren();
    if (!club) {
      body.appendChild(h("section", { className: "card diary-empty" }, [
        text("strong", {}, "Follow a club first"),
        text("p", {}, "Pick the club you support, or star a club, and its transfers, injuries and news appear here."),
        h("button", { type: "button", className: "primary-button", onClick: () => navigate("/appearance") }, "Pick my club"),
      ]));
      return;
    }
    if (clubs.length > 1) body.appendChild(pills(clubs.map((c) => ({ id: String(c.id), label: c.name })), (id) => { club = clubs.find((c) => String(c.id) === id); drawTab(); }, String(club.id)).node);
    body.appendChild(segmented([{ id: "transfers", label: "Transfers" }, { id: "injuries", label: "Injuries" }], (id) => { tab = id; drawTab(); }, tab).node);
    body.appendChild(h("div", { className: "hub-panel" }));
    drawTab();
  }

  body.appendChild(note("Loading\u2026"));
  hubClubs(store.getState()).then((list) => { clubs = list; club = list[0] || null; drawPage(); }).catch(() => { body.replaceChildren(note("Couldn't load your clubs.", "async-error-state")); });
  return root;
}
