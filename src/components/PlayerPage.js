import { h, text } from "../utils/h.js";
import { createAsyncPage } from "../utils/asyncPage.js";
import { getPlayerById } from "../api/footballApi.js";
import { SkeletonImage } from "./Skeleton.js";

// props: { id, onBack }
export function PlayerPage({ id, onBack }) {
  return createAsyncPage({
    title: "Player",
    onBack,
    fetchData: () => getPlayerById(id).then((results) => results[0] || null),
    notFoundMessage: "Player not found \u2014 API-Football's player endpoint needs a season alongside the id, and results can vary by season.",
    renderBody: (body, entry) => {
      const { player, statistics } = entry;
      const current = (statistics || [])[0];
      body.appendChild(
        h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" } }, [
          SkeletonImage({ src: player.photo, size: 80, radius: "50%" }),
          text("div", { style: { fontWeight: "700", fontSize: "18px", margin: "12px 0 4px", textAlign: "center" } }, player.name),
          text("div", { className: "mono eyebrow" }, `${(player.nationality || "").toUpperCase()}${player.age ? ` \u00b7 AGE ${player.age}` : ""}`),
        ])
      );
      if (current) {
        body.appendChild(
          h("div", { style: { background: "var(--surface)", borderRadius: "10px", padding: "14px" } }, [
            text("div", { style: { fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" } }, "CURRENT CLUB"),
            text("div", { style: { fontSize: "14px", fontWeight: "600" } }, current.team?.name || "\u2014"),
            current.league?.name ? text("div", { style: { fontSize: "12px", color: "var(--text-dim)", marginTop: "2px" } }, current.league.name) : null,
          ])
        );
      }
    },
  });
}
