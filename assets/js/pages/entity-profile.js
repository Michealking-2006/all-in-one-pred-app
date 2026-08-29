(() => {
  "use strict";

  const entity = window.__scoutwaveEntity;
  if (!entity) return;

  const root = document.querySelector("[data-entity-page]");
  if (!root) return;

  const name = root.querySelector("[data-entity-name]");
  const country = root.querySelector("[data-entity-country]");
  const logo = root.querySelector("[data-entity-logo]");
  const photo = root.querySelector("[data-entity-photo]");
  const state = root.querySelector("[data-entity-state]");

  if (name) name.textContent = entity.name || "Unknown";

  const location = entity.countryCode && entity.country
    ? `${entity.country} (${entity.countryCode})`
    : entity.country || entity.nationality || "";

  if (country) country.textContent = location;

  if (logo && entity.logo) {
    logo.src = entity.logo;
    logo.alt = entity.name || "League";
    logo.hidden = false;
  }

  if (photo && entity.photo) {
    photo.src = entity.photo;
    photo.alt = entity.name || "Player";
    photo.hidden = false;
  }

  if (state) {
    const details = [];

    if (entity.type === "league") {
      if (entity.type) details.push("Competition");
      if (entity.country) details.push(entity.country);
    }

    if (entity.type === "club") {
      if (entity.founded) details.push(`Founded ${entity.founded}`);
      if (entity.venue?.name) details.push(entity.venue.name);
    }

    if (entity.type === "player") {
      if (entity.nationality) details.push(entity.nationality);
      if (entity.age) details.push(`${entity.age} years old`);
      if (entity.team?.name) details.push(entity.team.name);
    }

    state.textContent = details.length ? details.join(" • ") : "";
  }

  window.__scoutwaveEntityPageCleanup = () => {
    window.__scoutwaveEntityPageCleanup = null;
  };
})();
