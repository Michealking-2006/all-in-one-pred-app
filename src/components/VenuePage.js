import { h, text } from "../utils/h.js";
import { createAsyncPage } from "../utils/asyncPage.js";
import { getVenueById } from "../api/footballApi.js";

// props: { id, onBack }
export function VenuePage({ id, onBack }) {
  return createAsyncPage({
    title: "Venue",
    onBack,
    fetchData: () => getVenueById(id).then((results) => results[0] || null),
    notFoundMessage: "Venue not found.",
    renderBody: (body, venue) => {
      body.appendChild(
        h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" } }, [
          venue.image
            ? h("img", { src: venue.image, alt: "", style: { width: "100%", maxWidth: "260px", borderRadius: "10px", marginBottom: "12px", objectFit: "cover" } })
            : h("i", { "data-lucide": "building-2", "aria-hidden": "true", style: { width: "48px", height: "48px", color: "var(--text-muted)", marginBottom: "12px" } }),
          text("div", { style: { fontWeight: "700", fontSize: "18px", marginBottom: "4px", textAlign: "center" } }, venue.name),
          text("div", { className: "mono eyebrow" }, `${(venue.city || "").toUpperCase()}${venue.country ? `, ${venue.country.toUpperCase()}` : ""}`),
        ])
      );
      body.appendChild(
        h("div", { style: { background: "var(--surface)", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" } }, [
          venue.address ? infoRow("Address", venue.address) : null,
          venue.capacity ? infoRow("Capacity", venue.capacity.toLocaleString()) : null,
          venue.surface ? infoRow("Surface", venue.surface) : null,
        ])
      );
    },
  });
}

function infoRow(label, value) {
  return h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "13px" } }, [
    text("span", { style: { color: "var(--text-muted)" } }, label),
    text("span", { style: { fontWeight: "500", textAlign: "right" } }, value),
  ]);
}
