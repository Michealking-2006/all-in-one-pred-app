import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { MatchRow } from "./MatchRow.js";
import { getFixturesByIds } from "../api/footballApi.js";
import { skeletonBlock } from "../utils/tabbedPage.js";

function emptyCard() {
  return h("section", { className: "empty-card card" }, [
    h("div", { className: "empty-icon" }, [h("i", { "data-lucide": "star" })]),
    text("strong", {}, "No favourites yet"),
    text("p", {}, "Tap the star on any match to keep it here."),
  ]);
}

export function FavoritesScreen({ favoriteMatchIds, onToggleFavorite, onOpenMatch, onBack }) {
  const body = h("div", { className: "favorites-body" });
  const root = h("main", { className: "screen favorites-screen" }, [
    PageHeader({ title: "My favourites", onBack }),
    h("section", { className: "favorites-intro" }, [
      text("span", { className: "section-kicker" }, "Watchlist"),
      text("h1", {}, "Matches you follow."),
      text("p", {}, "Your saved games stay one tap away."),
    ]),
    body,
  ]);

  if (!favoriteMatchIds.length) {
    body.appendChild(emptyCard());
    return root;
  }

  body.appendChild(skeletonBlock());
  getFixturesByIds(favoriteMatchIds)
    .then((rows) => {
      body.innerHTML = "";
      // Only show what is still favourited (the list changes as stars are toggled off).
      const sorted = [...rows].sort((a, b) => (a.fixture?.timestamp || 0) - (b.fixture?.timestamp || 0));
      if (!sorted.length) {
        body.appendChild(emptyCard());
        return;
      }
      const list = h("div", { className: "ios-match-list" });
      const section = h("section", { className: "ios-league-section favorites-list" }, [list]);
      body.appendChild(section);

      sorted.forEach((fx) => {
        const row = MatchRow(fx, {
          isFavorite: true,
          onOpen: onOpenMatch,
          // Un-starring removes the row from this list right away.
          onToggleFavorite: (id) => {
            const now = onToggleFavorite(id);
            if (!now) {
              row.remove();
              if (!list.children.length) {
                section.remove();
                body.appendChild(emptyCard());
              }
            }
            return now;
          },
        });
        list.appendChild(row);
      });
    })
    .catch((error) => {
      body.innerHTML = "";
      body.appendChild(text("div", { className: "async-error-state" }, error?.message || "Couldn't load your favourites."));
    });

  return root;
}
