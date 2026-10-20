// A space for an ad or a house promotion, managed from the admin dashboard (Remote config >
// Placements). Returns nothing at all when the space is off, so an empty slot never leaves a gap.
// Always labelled ("Sponsored", "Ad", ...) so nobody mistakes it for a news story.
import { h, text } from "../utils/h.js";
import { getRemote } from "../remoteConfig.js";

export function placement(slot) {
  const p = getRemote()?.placements?.[slot];
  if (!p) return null;
  const external = /^https?:\/\//i.test(p.link);
  const link = h("a", {
    className: "placement-card" + (p.image ? " has-image" : ""),
    href: p.link,
    ...(external ? { target: "_blank", rel: "sponsored noopener noreferrer" } : {}),
    "aria-label": `${p.label}: ${p.title}`,
  }, [
    p.image ? h("img", { className: "placement-image", src: p.image, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer", onError: (e) => e.target.remove() }) : null,
    h("div", { className: "placement-copy" }, [
      text("span", { className: "placement-label" }, p.label),
      text("strong", {}, p.title),
      p.text ? text("p", {}, p.text) : null,
      text("span", { className: "placement-cta" }, p.cta),
    ]),
  ]);
  return h("aside", { className: "placement", "data-slot": slot }, [link]);
}
