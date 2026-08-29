(() => {
  "use strict";

  if (window.__scoutwaveEntityProfileMounted) return;
  window.__scoutwaveEntityProfileMounted = true;

  const entity = window.__scoutwaveEntity;
  const root = document.querySelector("[data-entity-page]");

  if (!entity || !root) {
    window.__scoutwaveEntityProfileMounted = false;
    return;
  }

  const $ = selector => root.querySelector(selector);
  const name = $("[data-entity-name]");
  const country = $("[data-entity-country]");
  const logo = $("[data-entity-logo]");
  const photo = $("[data-entity-photo]");
  const state = $("[data-entity-state]");
  const content = $("[data-entity-details]");

  const escapeHTML = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function setImage(element, src, alt, fallbackClass = "") {
    if (!element) return;
    if (!src) {
      element.hidden = true;
      return;
    }
    element.src = src;
    element.alt = alt || "";
    element.classList.toggle("is-fallback", false);
    element.hidden = false;
    element.onerror = () => {
      element.hidden = true;
      if (fallbackClass) element.parentElement?.classList.add(fallbackClass);
    };
  }

  function formatValue(value) {
    return value === null || value === undefined || value === "" ? "—" : escapeHTML(value);
  }

  function renderRows(rows) {
    return rows.map(([label, value]) => `
      <div class="entity-detail-row">
        <span>${escapeHTML(label)}</span>
        <strong>${formatValue(value)}</strong>
      </div>
    `).join("");
  }

  function endpointFor(type, id) {
    const endpoints = {
      league: `/leagues?id=${encodeURIComponent(id)}`,
      club: `/teams?id=${encodeURIComponent(id)}`,
      player: `/players?id=${encodeURIComponent(id)}`,
    };
    return endpoints[type] || null;
  }

  async function fetchDetails() {
    const endpoint = endpointFor(entity.type, entity.id);
    if (!endpoint) throw new Error("Unsupported entity type");

    const response = await fetch(`/api/football?path=${encodeURIComponent(endpoint)}`, {
      headers: { accept: "application/json" },
      cache: "default",
    });

    if (!response.ok) throw new Error(`Profile API HTTP ${response.status}`);

    const data = await response.json();
    return data?.response?.[0] || null;
  }

  function renderBase() {
    if (name) name.textContent = entity.name || "Unknown";

    const location = entity.countryCode && entity.country
      ? `${entity.country} (${entity.countryCode})`
      : entity.country || entity.nationality || "";

    if (country) country.textContent = location;

    if (entity.type === "player") {
      setImage(photo, entity.photo, entity.name, "entity-photo-failed");
      if (logo) logo.hidden = true;
    } else {
      setImage(logo, entity.logo, entity.name, "entity-logo-failed");
      if (photo) photo.hidden = true;
    }
  }

  function renderDetails(data) {
    if (!content) return;

    if (entity.type === "league") {
      const league = data?.league || entity;
      const countryData = data?.country || {};
      content.innerHTML = `
        <div class="entity-detail-grid">
          ${renderRows([
            ["Competition", league.name],
            ["Country", countryData.name || entity.country],
            ["Type", league.type],
            ["League ID", league.id],
          ])}
        </div>
      `;
      return;
    }

    if (entity.type === "club") {
      const team = data?.team || entity;
      const venue = data?.venue || entity.venue || {};
      content.innerHTML = `
        <div class="entity-detail-grid">
          ${renderRows([
            ["Club", team.name],
            ["Country", team.country || entity.country],
            ["Founded", team.founded],
            ["Venue", venue.name],
            ["City", venue.city],
            ["Stadium capacity", venue.capacity],
          ])}
        </div>
      `;
      return;
    }

    const player = data?.player || entity;
    const team = data?.statistics?.[0]?.team || entity.team || {};
    const stats = data?.statistics?.[0] || {};
    const birth = player.birth || {};

    if (photo && player.photo) setImage(photo, player.photo, `${player.firstname || ""} ${player.lastname || ""}`.trim());

    content.innerHTML = `
      <div class="entity-detail-grid">
        ${renderRows([
          ["Full name", [player.firstname, player.lastname].filter(Boolean).join(" ")],
          ["Nationality", player.nationality],
          ["Age", player.age],
          ["Date of birth", birth.date],
          ["Position", stats.games?.position],
          ["Current club", team.name],
          ["Number", stats.games?.number],
        ])}
      </div>
    `;
  }

  async function mount() {
    renderBase();

    if (state) state.textContent = "Loading profile…";
    if (content) content.innerHTML = "";

    try {
      const data = await fetchDetails();
      renderDetails(data);
      if (state) state.textContent = entity.type === "league"
        ? "Competition profile"
        : entity.type === "club"
          ? "Club profile"
          : "Player profile";
    } catch (error) {
      console.error("[Scoutwave] entity profile error", error);
      if (state) state.textContent = "Some profile details could not be loaded.";
      renderDetails(null);
    }
  }

  mount();

  window.__scoutwaveEntityPageCleanup = () => {
    window.__scoutwaveEntityPageCleanup = null;
    window.__scoutwaveEntityProfileMounted = false;
  };
})();
