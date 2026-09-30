export function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents (é -> e)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// API-Football only understands numeric IDs, not names — so a pure name-only
// slug like "/league/la-liga" can't be resolved back to an API call, and
// risks collisions (two "United"s, etc). Embedding the ID keeps the URL
// readable while staying resolvable: "140-la-liga" -> id 140.
export function buildSlug(id, name) {
  return `${id}-${slugify(name)}`;
}

export function parseSlugId(slug) {
  const id = parseInt(slug.split("-")[0], 10);
  return Number.isNaN(id) ? null : id;
}
