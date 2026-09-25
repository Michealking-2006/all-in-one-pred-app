import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { MatchRow } from "./MatchRow.js";
import { getFixturesByIds, getTeamById, getPlayerProfile, getVenueById, getLeagueById } from "../api/footballApi.js";
import { SkeletonMatchList, SkeletonList } from "./Skeleton.js";
import { favoriteEntityRow } from "../utils/ui.js";
import { buildSlug } from "../utils/slug.js";

function emptyCard(message) {
  return h("section", { className: "empty-card card" }, [
    h("div", { className: "empty-icon" }, [h("i", { "data-lucide": "star" })]),
    text("strong", {}, "No favourites yet"),
    text("p", {}, message),
  ]);
}

// Tracks how many of the page's sections still have at least one favourite in
// them. When the last one empties out (the user un-starred everything while
// sitting on this page), it swaps the whole body for the empty state — each
// section only needs to report its own removal, not coordinate with siblings.
function createEmptyStateGuard(body, sectionCount) {
  let remaining = sectionCount;
  return function sectionEmptied() {
    remaining -= 1;
    if (remaining <= 0) {
      body.replaceChildren(emptyCard("Tap the star on any match, club, player, venue or league to keep it here."));
    }
  };
}

// One entry per favouritable type: how to fetch every favourited id of that
// type, how to display each result as a row, and where its star button opens.
// A single failed id never drops the rest (fetched independently, per id).
const SECTIONS = {
  club: {
    title: "Clubs",
    skeletonAvatar: "square",
    fetch: (ids) => Promise.all(ids.map((id) => getTeamById(id).then((rows) => rows[0]).catch(() => null))),
    toRow: (r) => ({ id: r.team.id, image: r.team.logo, title: r.team.name, subtitle: r.team.country, path: `/club/${buildSlug(r.team.id, r.team.name)}` }),
  },
  player: {
    title: "Players",
    skeletonAvatar: "round",
    fetch: (ids) => Promise.all(ids.map((id) => getPlayerProfile(id).catch(() => null))),
    toRow: (r) => ({ id: r.player.id, image: r.player.photo, title: r.player.name, subtitle: r.player.nationality, path: `/player/${buildSlug(r.player.id, r.player.name)}`, round: true }),
  },
  venue: {
    title: "Venues",
    skeletonAvatar: "square",
    fetch: (ids) => Promise.all(ids.map((id) => getVenueById(id).then((rows) => rows[0]).catch(() => null))),
    toRow: (r) => ({ id: r.id, image: r.image, title: r.name, subtitle: r.city, path: `/venue/${buildSlug(r.id, r.name)}` }),
  },
  league: {
    title: "Leagues",
    skeletonAvatar: "square",
    fetch: (ids) => Promise.all(ids.map((id) => getLeagueById(id).then((rows) => rows[0]).catch(() => null))),
    toRow: (r) => ({ id: r.league.id, image: r.league.logo, title: r.league.name, subtitle: r.country?.name, path: `/league/${buildSlug(r.league.id, r.league.name)}` }),
  },
};

// Renders one entity-type section (club/player/venue/league): its own
// skeleton while loading, its own error state, and rows that remove
// themselves live when un-starred (collapsing the whole section if it empties
// out), without disturbing any other section on the page.
function entitySection(type, ids, onToggleFavorite, onOpenEntity, onEmptied) {
  const def = SECTIONS[type];
  const body = h("div", {});
  const section = h("section", { className: "favorites-section" }, [
    text("div", { className: "section-kicker favorites-section-kicker" }, def.title),
    body,
  ]);

  body.appendChild(SkeletonList({ rows: Math.min(3, ids.length), avatar: def.skeletonAvatar, lines: 2, trailing: true }));
  def.fetch(ids)
    .then((results) => {
      const found = results.filter(Boolean).map(def.toRow);
      if (!found.length) { section.remove(); onEmptied(); return; }
      const list = h("div", { className: "entity-list" });
      body.replaceChildren(list);
      found.forEach((entity) => {
        const row = favoriteEntityRow({
          image: entity.image,
          title: entity.title,
          subtitle: entity.subtitle,
          round: entity.round,
          isFavorite: true,
          onOpen: () => onOpenEntity(entity.path),
          onToggleFavorite: () => {
            const now = onToggleFavorite(type, entity.id);
            if (!now) {
              row.remove();
              if (!list.children.length) { section.remove(); onEmptied(); }
            }
            return now;
          },
        });
        list.appendChild(row);
      });
    })
    .catch((error) => {
      body.replaceChildren(text("div", { className: "async-error-state" }, error?.message || `Couldn't load your favourite ${def.title.toLowerCase()}.`));
    });

  return section;
}

// Matches keep their own proven path (bulk-fetched, sorted by kick-off,
// MatchRow's own star behaviour) rather than being forced through the
// generic entity-row shape above.
function matchSection(ids, onToggleFavorite, onOpenMatch, onEmptied) {
  const body = h("div", {});
  const section = h("section", { className: "favorites-section" }, [
    text("div", { className: "section-kicker favorites-section-kicker" }, "Matches"),
    body,
  ]);

  body.appendChild(SkeletonMatchList({ leagues: 1, rows: Math.min(3, Math.max(1, ids.length)) }));
  getFixturesByIds(ids)
    .then((rows) => {
      const sorted = [...rows].sort((a, b) => (a.fixture?.timestamp || 0) - (b.fixture?.timestamp || 0));
      if (!sorted.length) { section.remove(); onEmptied(); return; }
      const list = h("div", { className: "ios-match-list" });
      const listCard = h("section", { className: "ios-league-section favorites-list" }, [list]);
      body.replaceChildren(listCard);

      sorted.forEach((fx) => {
        const row = MatchRow(fx, {
          isFavorite: true,
          onOpen: onOpenMatch,
          onToggleFavorite: (id) => {
            const now = onToggleFavorite("match", id);
            if (!now) {
              row.remove();
              if (!list.children.length) { section.remove(); onEmptied(); }
            }
            return now;
          },
        });
        list.appendChild(row);
      });
    })
    .catch((error) => {
      body.replaceChildren(text("div", { className: "async-error-state" }, error?.message || "Couldn't load your favourite matches."));
    });

  return section;
}

export function FavoritesScreen({ favorites, onToggleFavorite, onOpenMatch, onOpenEntity, onBack }) {
  const body = h("div", { className: "favorites-body" });
  const root = h("main", { className: "screen favorites-screen" }, [
    PageHeader({ title: "My favourites", onBack }),
    h("section", { className: "favorites-intro" }, [
      text("span", { className: "section-kicker" }, "Watchlist"),
      text("h1", {}, "Things you follow."),
      text("p", {}, "Matches, clubs, players, venues and leagues, one tap away."),
    ]),
    body,
  ]);

  const activeTypes = ["match", "club", "player", "venue", "league"].filter((type) => favorites[type]?.length);
  if (!activeTypes.length) {
    body.appendChild(emptyCard("Tap the star on any match, club, player, venue or league to keep it here."));
    return root;
  }

  const onEmptied = createEmptyStateGuard(body, activeTypes.length);
  for (const type of activeTypes) {
    body.appendChild(
      type === "match"
        ? matchSection(favorites.match, onToggleFavorite, onOpenMatch, onEmptied)
        : entitySection(type, favorites[type], onToggleFavorite, onOpenEntity, onEmptied)
    );
  }

  return root;
}
