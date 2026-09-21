import { h, text } from "../utils/h.js";
import { createAsyncPage } from "../utils/asyncPage.js";
import { getVenueById, getVenueTeams, getVenueFixtures } from "../api/footballApi.js";
import { asyncSection, statTiles, kvCard } from "../utils/sections.js";
import { entityRow, entityList, metaLine } from "../utils/ui.js";
import { FixtureCard, groupByDay } from "./FixtureCard.js";
import { buildSlug } from "../utils/slug.js";
import { navigate } from "../router.js";

const mapsUrl = (venue) =>
  "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([venue.name, venue.address, venue.city, venue.country].filter(Boolean).join(", "));

function fixtureList(fixtures) {
  if (!fixtures.length) return null;
  const nodes = [];
  groupByDay(fixtures).forEach((group) => {
    nodes.push(text("div", { className: "day-heading" }, group.label));
    group.items.forEach((fx) => nodes.push(FixtureCard(fx, { showLeague: true })));
  });
  return h("div", { className: "fixture-list" }, nodes);
}

export function VenuePage({ id, onBack }) {
  return createAsyncPage({
    title: "Venue",
    onBack,
    fetchData: () => getVenueById(id).then((rows) => rows[0] || null),
    notFoundMessage: "Venue not found.",
    renderBody: (body, venue) => {
      const page = h("div", { className: "entity-page" });
      body.appendChild(page);

      // Hero: photo when the provider has one, otherwise an icon tile.
      page.appendChild(h("section", { className: "venue-hero" }, [
        venue.image
          ? h("img", { className: "venue-image", src: venue.image, alt: venue.name })
          : h("div", { className: "venue-image placeholder" }, [h("i", { "data-lucide": "building-2" })]),
        text("h1", { className: "entity-title" }, venue.name),
        metaLine([venue.city, venue.country], "meta-line entity-meta"),
      ]));

      const tiles = statTiles([
        ["Capacity", venue.capacity ? Number(venue.capacity).toLocaleString() : null],
        ["Surface", venue.surface ? String(venue.surface).replace(/^./, (c) => c.toUpperCase()) : null],
      ]);
      if (tiles) page.appendChild(h("div", { className: "info-section" }, [tiles]));

      const details = kvCard([["Address", venue.address], ["City", venue.city], ["Country", venue.country]]);
      if (details) page.appendChild(h("div", { className: "info-section" }, [details]));

      page.appendChild(h("div", { className: "info-section" }, [
        h("a", { className: "secondary-button wide", href: mapsUrl(venue), target: "_blank", rel: "noopener noreferrer" }, [
          h("i", { "data-lucide": "map-pin", "aria-hidden": "true" }), text("span", {}, "Open in Maps"),
        ]),
      ]));

      page.appendChild(asyncSection({
        title: "Home clubs",
        load: () => getVenueTeams(id),
        render: (rows) => entityList(rows.map(({ team }) => team && entityRow({
          image: team.logo, title: team.name, subtitle: team.country,
          onClick: () => navigate("/club/" + buildSlug(team.id, team.name)),
        }))),
      }));

      page.appendChild(asyncSection({
        title: "Upcoming matches",
        load: () => getVenueFixtures(id, { next: 5 }).then((rows) => [...rows].sort((a, b) => (a.fixture?.timestamp || 0) - (b.fixture?.timestamp || 0))),
        render: fixtureList,
      }));

      page.appendChild(asyncSection({
        title: "Recent matches",
        load: () => getVenueFixtures(id, { last: 5 }).then((rows) => [...rows].sort((a, b) => (a.fixture?.timestamp || 0) - (b.fixture?.timestamp || 0)).reverse()),
        render: fixtureList,
      }));
    },
  });
}
