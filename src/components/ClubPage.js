import { h, text } from "../utils/h.js";
import { createAsyncPage } from "../utils/asyncPage.js";
import { getTeamById } from "../api/footballApi.js";

// props: { id, onBack }
export function ClubPage({ id, onBack }) {
  return createAsyncPage({
    title: "Club",
    onBack,
    fetchData: () => getTeamById(id).then((results) => results[0] || null),
    notFoundMessage: "Club not found.",
    renderBody: (body, entry) => {
      const { team, venue } = entry;
      body.appendChild(
        h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" } }, [
          h("img", { src: team.logo, alt: "", style: { width: "64px", height: "64px", objectFit: "contain", marginBottom: "10px" } }),
          text("div", { style: { fontWeight: "700", fontSize: "18px", marginBottom: "4px", textAlign: "center" } }, team.name),
          text("div", { className: "mono eyebrow" }, `${(team.country || "").toUpperCase()}${team.founded ? ` \u00b7 FOUNDED ${team.founded}` : ""}`),
        ])
      );
      if (venue?.name) {
        body.appendChild(
          h("div", { style: { background: "var(--surface)", borderRadius: "10px", padding: "14px" } }, [
            text("div", { style: { fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" } }, "HOME VENUE"),
            text("div", { style: { fontSize: "14px", fontWeight: "600", marginBottom: "2px" } }, venue.name),
            venue.city ? text("div", { style: { fontSize: "12px", color: "var(--text-dim)" } }, `${venue.city}${venue.capacity ? ` \u00b7 ${venue.capacity.toLocaleString()} capacity` : ""}`) : null,
          ])
        );
      }
    },
  });
}
