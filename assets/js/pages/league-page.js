/**
 * =====================
 * LEAGUE PAGE
 * SPA SAFE + CLEANUP
 * =====================
 */

let LEAGUE_PAGE_CACHE = null;

const LEAGUE_PAGE_STATE = {
    active: false,
    slug: null,
    controller: null,
    requestToken: 0,
    loading: false
};

const FAVOURITES_PAGE_STATE = {
    active: false,
    controller: null
};

const LEAGUE_FAVOURITES_KEY = "league-favourites";

/* =====================================================
   SMALL HELPERS
===================================================== */

function lpSafeJSONParse(value, fallback = null) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

function lpEscapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function lpFormatDate(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function lpSetText(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text ?? "";
}

function lpSetHTML(selector, html) {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = html;
}

function lpSetImage(selector, src = "", alt = "") {
    const el = document.querySelector(selector);
    if (!el) return;

    el.src = src || "";
    el.alt = alt || "";
}

function lpNavigate(path) {
    if (typeof window.navigate === "function") {
        window.navigate(path);
        return;
    }

    history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
}

function lpCurrentPath() {
    try {
        return window.router?.getCurrentPath?.() || location.pathname;
    } catch {
        return location.pathname;
    }
}

function lpNormalizePath(path) {
    if (!path) return "/";

    try {
        const url = new URL(path, location.origin);
        return url.pathname.replace(/\/+$/, "") || "/";
    } catch {
        return String(path).split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
    }
}

function lpIsLeagueRoute(path) {
    const clean = lpNormalizePath(path);
    return (
        clean === "/league-page" ||
        clean.startsWith("/league-page/") ||
        clean.startsWith("/league/")
    );
}

function lpIsFavouritesRoute(path) {
    return lpNormalizePath(path) === "/favourites";
}

function lpGetPathSlug() {
    const parts = lpNormalizePath(lpCurrentPath()).split("/").filter(Boolean);

    const idx = parts.indexOf("league-page");
    if (idx >= 0 && parts[idx + 1]) {
        return decodeURIComponent(parts[idx + 1]).toLowerCase();
    }

    const leagueIdx = parts.indexOf("league");
    if (leagueIdx >= 0 && parts[leagueIdx + 1]) {
        return decodeURIComponent(parts[leagueIdx + 1]).toLowerCase();
    }

    return decodeURIComponent(parts[parts.length - 1] || "").toLowerCase();
}

function lpGetSeasonFromSelect() {
    const select = document.getElementById("seasonSelect");
    if (!select) return null;

    const text = (select.options[select.selectedIndex]?.textContent || "").trim();
    const match = text.match(/^(\d{4})/);
    if (match) return Number(match[1]);

    const valueNum = Number(select.value);
    if (Number.isFinite(valueNum) && valueNum > 1900) return valueNum;

    return null;
}

function lpShowEmpty(targetId, message, colspan = 1) {
    const el = document.getElementById(targetId);
    if (!el) return;

    if (el.tagName === "TBODY") {
        el.innerHTML = `
            <tr>
                <td colspan="${colspan}">
                    <div class="empty-state">${lpEscapeHtml(message)}</div>
                </td>
            </tr>
        `;
        return;
    }

    el.innerHTML = `<div class="empty-state">${lpEscapeHtml(message)}</div>`;
}

function lpGetStoredContext() {
    return (
        lpSafeJSONParse(sessionStorage.getItem("selectedLeaguePage")) ||
        lpSafeJSONParse(sessionStorage.getItem("selectedLeague")) ||
        window.__leaguePageData ||
        null
    );
}

function lpSaveContext(data) {
    if (!data) return;

    sessionStorage.setItem("selectedLeaguePage", JSON.stringify(data));
    sessionStorage.setItem("selectedLeague", JSON.stringify(data));
    window.__leaguePageData = data;
}

function lpGetAPI() {
    if (typeof globalThis !== "undefined" && globalThis.API) return globalThis.API;

    try {
        if (typeof API !== "undefined") return API;
    } catch {
        // ignore
    }

    return null;
}

async function lpLoadLeaguesJSON() {
    if (LEAGUE_PAGE_CACHE) return LEAGUE_PAGE_CACHE;

    const res = await fetch("/assets/data/leagues.json");
    if (!res.ok) throw new Error("Unable to load leagues.json");

    LEAGUE_PAGE_CACHE = await res.json();
    return LEAGUE_PAGE_CACHE;
}

async function lpFindLeagueBySlug(slug) {
    const data = await lpLoadLeaguesJSON();
    const cleanSlug = String(slug || "").trim().toLowerCase();

    for (const country of data.countries || []) {
        for (const league of country.leagues || []) {
            if (String(league.slug || "").toLowerCase() === cleanSlug) {
                return { country, league };
            }
        }
    }

    return null;
}

function lpGetStandingRows(standings) {
    if (Array.isArray(standings?.[0])) return standings[0];
    if (Array.isArray(standings)) return standings;
    return [];
}

/* =====================================================
   LOADING MARKUP
===================================================== */

function lpLoadingMarkup(type) {
    switch (type) {
        case "top-scorer":
            return `
                <div class="top-scorer">
                    <div class="top-scorer-image">
                        <div class="skeleton skeleton-avatar"></div>
                    </div>

                    <div class="top-scorer-text">
                        <div class="skeleton skeleton-line line-lg"></div>
                        <div class="skeleton skeleton-line line-md"></div>
                        <div class="skeleton skeleton-line line-sm"></div>
                    </div>
                </div>
            `;

        case "featured-match":
            return `
                <div class="featured-match">
                    <div class="featured-teams">
                        <div class="featured-team">
                            <div class="skeleton skeleton-avatar" style="width:34px;height:34px;border-radius:50%;"></div>
                            <div class="skeleton skeleton-line line-md"></div>
                        </div>

                        <div class="featured-score">
                            <div class="skeleton skeleton-line line-sm"></div>
                        </div>

                        <div class="featured-team">
                            <div class="skeleton skeleton-avatar" style="width:34px;height:34px;border-radius:50%;"></div>
                            <div class="skeleton skeleton-line line-md"></div>
                        </div>
                    </div>

                    <div class="featured-date">
                        <div class="skeleton skeleton-line line-sm"></div>
                    </div>

                    <div class="featured-prediction">
                        <div class="skeleton skeleton-line line-md"></div>
                    </div>
                </div>
            `;

        case "standings":
            return Array.from({ length: 8 }, () => `
                <tr>
                    <td><div class="skeleton skeleton-line" style="width:24px;height:14px;"></div></td>
                    <td><div class="skeleton skeleton-line" style="width:140px;height:14px;"></div></td>
                    <td><div class="skeleton skeleton-line" style="width:28px;height:14px;"></div></td>
                    <td><div class="skeleton skeleton-line" style="width:28px;height:14px;"></div></td>
                    <td><div class="skeleton skeleton-line" style="width:28px;height:14px;"></div></td>
                    <td><div class="skeleton skeleton-line" style="width:28px;height:14px;"></div></td>
                    <td><div class="skeleton skeleton-line" style="width:28px;height:14px;"></div></td>
                    <td><div class="skeleton skeleton-line" style="width:28px;height:14px;"></div></td>
                </tr>
            `).join("");

        case "matches":
            return Array.from({ length: 5 }, () => `
                <div class="match-item">
                    <div class="match-teams">
                        <div class="match-team">
                            <div class="skeleton skeleton-avatar" style="width:28px;height:28px;"></div>
                            <div class="skeleton skeleton-line line-md"></div>
                        </div>
                        <div class="skeleton skeleton-line line-sm"></div>
                        <div class="match-team">
                            <div class="skeleton skeleton-avatar" style="width:28px;height:28px;"></div>
                            <div class="skeleton skeleton-line line-md"></div>
                        </div>
                    </div>

                    <div class="match-meta">
                        <div class="skeleton skeleton-line line-sm"></div>
                        <div class="skeleton skeleton-line line-sm"></div>
                    </div>
                </div>
            `).join("");

        default:
            return `<div class="skeleton skeleton-line line-lg"></div>`;
    }
}

/* =====================================================
   RENDER HELPERS
===================================================== */

function lpFeaturedMatchHTML(match) {
    if (!match) {
        return `<div class="empty-state">No featured match yet.</div>`;
    }

    const teams = match.teams || {};
    const fixture = match.fixture || {};

    const home = teams.home?.name || "Home";
    const away = teams.away?.name || "Away";
    const homeLogo = teams.home?.logo || "";
    const awayLogo = teams.away?.logo || "";

    const date = fixture.date ? new Date(fixture.date) : null;
    const matchDate = date
        ? date.toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        })
        : "";

    const matchTime = date
        ? date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        })
        : "";

    const prediction = match.prediction || match.predictions || match.probabilities || {};
    const homeChance = prediction.home ?? prediction.homeWin ?? prediction.win_home ?? prediction.one ?? null;
    const drawChance = prediction.draw ?? prediction.x ?? prediction.xWin ?? null;
    const awayChance = prediction.away ?? prediction.awayWin ?? prediction.win_away ?? prediction.two ?? null;

    return `
        <div class="featured-match">
            <div class="featured-teams">
                <div class="featured-team">
                    ${homeLogo ? `<img src="${lpEscapeHtml(homeLogo)}" alt="${lpEscapeHtml(home)}">` : ""}
                    <strong>${lpEscapeHtml(home)}</strong>
                </div>

                <div class="featured-score">
                    <span>VS</span>
                </div>

                <div class="featured-team">
                    ${awayLogo ? `<img src="${lpEscapeHtml(awayLogo)}" alt="${lpEscapeHtml(away)}">` : ""}
                    <strong>${lpEscapeHtml(away)}</strong>
                </div>
            </div>

            <div class="featured-date">
                ${matchDate ? `<span>${lpEscapeHtml(matchDate)}</span>` : ""}
                ${matchTime ? `<span>${lpEscapeHtml(matchTime)}</span>` : ""}
            </div>

            <div class="featured-prediction">
                <span class="prediction-label">Prediction</span>

                <div class="prediction-row">
                    <span class="prediction-pill">
                        Home ${homeChance !== null && homeChance !== undefined ? `${lpEscapeHtml(homeChance)}%` : ""}
                    </span>
                    <span class="prediction-pill">
                        Draw ${drawChance !== null && drawChance !== undefined ? `${lpEscapeHtml(drawChance)}%` : ""}
                    </span>
                    <span class="prediction-pill">
                        Away ${awayChance !== null && awayChance !== undefined ? `${lpEscapeHtml(awayChance)}%` : ""}
                    </span>
                </div>
            </div>
        </div>
    `;
}

function lpTopScorerHTML(scorer) {
    if (!scorer) {
        return `<div class="empty-state">No top scorer yet.</div>`;
    }

    const player = scorer.player || scorer;
    const stat = scorer.statistics?.[0] || {};

    const name = player.name || scorer.name || "Unknown";
    const image = player.photo || scorer.photo || scorer.image || scorer.avatar || "";

    const team = stat.team?.name || scorer.team?.name || "";
    const teamLogo = stat.team?.logo || scorer.team?.logo || "";

    const fullPosition = stat.games?.position || player.position || scorer.position || "";

    const POSITION_MAP = {
        Goalkeeper: "GK",
        Defender: "DEF",
        "Centre-Back": "CB",
        "Center Back": "CB",
        "Right-Back": "RB",
        "Left-Back": "LB",
        "Wing-Back": "WB",
        Midfielder: "MID",
        "Defensive Midfielder": "CDM",
        "Central Midfielder": "CM",
        "Attacking Midfielder": "CAM",
        "Right Midfielder": "RM",
        "Left Midfielder": "LM",
        Forward: "FW",
        "Centre-Forward": "CF",
        "Center Forward": "CF",
        Striker: "ST",
        "Second Striker": "SS",
        "Right Winger": "RW",
        "Left Winger": "LW"
    };

    const shortPosition = POSITION_MAP[fullPosition] || fullPosition;

    let positionClass = "";
    if (["GK"].includes(shortPosition)) positionClass = "position-gk";
    else if (["DEF", "CB", "RB", "LB", "WB"].includes(shortPosition)) positionClass = "position-def";
    else if (["MID", "CDM", "CM", "CAM", "RM", "LM"].includes(shortPosition)) positionClass = "position-mid";
    else if (["FW", "CF", "ST", "SS", "RW", "LW"].includes(shortPosition)) positionClass = "position-att";

    const nationality = player.nationality || scorer.nationality || "";
    const age = player.age || scorer.age || "";

    let height = player.height || scorer.height || "";
    let weight = player.weight || scorer.weight || "";

    if (height && !/cm/i.test(height)) height += " cm";
    if (weight && !/kg/i.test(weight)) weight += " kg";

    const goals = stat.goals?.total ?? scorer.goals ?? scorer.score ?? 0;
    const assists = stat.goals?.assists ?? scorer.assists ?? "-";
    const appearances = stat.games?.appearences ?? stat.games?.appearances ?? scorer.appearances ?? "-";
    const rating = stat.games?.rating ?? scorer.rating ?? "-";

    return `
        <div class="top-scorer">
            <div class="top-scorer-image">
                ${
                    teamLogo
                        ? `
                            <div class="club-badge">
                                <img src="${lpEscapeHtml(teamLogo)}" alt="${lpEscapeHtml(team)}">
                            </div>
                        `
                        : ""
                }

                ${
                    image
                        ? `
                            <img
                                class="player-photo"
                                src="${lpEscapeHtml(image)}"
                                alt="${lpEscapeHtml(name)}"
                                loading="lazy"
                            >
                        `
                        : `<div class="skeleton skeleton-avatar"></div>`
                }

                ${
                    shortPosition
                        ? `
                            <div class="position-badge ${positionClass}">
                                ${lpEscapeHtml(shortPosition)}
                            </div>
                        `
                        : ""
                }
            </div>

            <div class="top-scorer-text">
                <strong>${lpEscapeHtml(name)}</strong>
                ${team ? `<p>${lpEscapeHtml(team)}</p>` : ""}

                ${
                    nationality
                        ? `<small><span>Nationality</span><span>${lpEscapeHtml(nationality)}</span></small>`
                        : ""
                }

                ${
                    fullPosition
                        ? `<small><span>Position</span><span>${lpEscapeHtml(fullPosition)}</span></small>`
                        : ""
                }

                ${age ? `<small><span>Age</span><span>${lpEscapeHtml(age)} yrs</span></small>` : ""}
                ${height ? `<small><span>Height</span><span>${lpEscapeHtml(height)}</span></small>` : ""}
                ${weight ? `<small><span>Weight</span><span>${lpEscapeHtml(weight)}</span></small>` : ""}

                <small><span>Appearances</span><span>${lpEscapeHtml(appearances)}</span></small>
                <small><span>Assists</span><span>${lpEscapeHtml(assists)}</span></small>
                <small><span>Rating</span><span>${lpEscapeHtml(rating)}</span></small>

                <small class="goals-row">
                    <span>Goals</span>
                    <span>${lpEscapeHtml(goals)}</span>
                </small>
            </div>
        </div>
    `;
}

function lpStandingsHTML(standings) {
    const rows = lpGetStandingRows(standings);

    if (!rows.length) {
        return `
            <tr>
                <td colspan="8">
                    <div class="empty-state">No standings available.</div>
                </td>
            </tr>
        `;
    }

    return rows.map((row, index) => {
        const team = row.team?.name || row.team || row.club || "Unknown";
        const logo = row.team?.logo || row.teamLogo || "";
        const stats = row.all || row.stats || {};

        const mp = stats.played ?? row.played ?? row.mp ?? "-";
        const w = stats.win ?? row.win ?? row.w ?? "-";
        const d = stats.draw ?? row.draw ?? row.d ?? "-";
        const l = stats.lose ?? row.lose ?? row.l ?? "-";
        const gd = row.goalsDiff ?? row.gd ?? "-";
        const pts = row.points ?? row.pts ?? "-";
        const rank = row.rank ?? row.position ?? index + 1;

        return `
            <tr>
                <td>${lpEscapeHtml(rank)}</td>
                <td>
                    <div class="table-team">
                        ${logo ? `<img src="${lpEscapeHtml(logo)}" alt="${lpEscapeHtml(team)}">` : ""}
                        <span>${lpEscapeHtml(team)}</span>
                    </div>
                </td>
                <td>${lpEscapeHtml(mp)}</td>
                <td>${lpEscapeHtml(w)}</td>
                <td>${lpEscapeHtml(d)}</td>
                <td>${lpEscapeHtml(l)}</td>
                <td>${lpEscapeHtml(gd)}</td>
                <td><strong>${lpEscapeHtml(pts)}</strong></td>
            </tr>
        `;
    }).join("");
}

function lpMatchesHTML(matches) {
    const items = Array.isArray(matches) ? matches : [];

    if (!items.length) {
        return `<div class="empty-state">No predicted matches.</div>`;
    }

    return items.map(match => {
        const home = match.teams?.home?.name || match.homeTeam?.name || match.home?.name || "Home";
        const away = match.teams?.away?.name || match.awayTeam?.name || match.away?.name || "Away";
        const homeLogo = match.teams?.home?.logo || match.homeTeam?.logo || match.home?.logo || "";
        const awayLogo = match.teams?.away?.logo || match.awayTeam?.logo || match.away?.logo || "";
        const date = match.fixture?.date || match.date || match.time || match.utcDate || "";
        const status = match.fixture?.status?.short || match.fixture?.status?.long || match.status || match.state || "";

        return `
            <div class="match-item">
                <div class="match-teams">
                    <div class="match-team">
                        ${homeLogo ? `<img src="${lpEscapeHtml(homeLogo)}" alt="${lpEscapeHtml(home)}">` : ""}
                        <span>${lpEscapeHtml(home)}</span>
                    </div>

                    <strong>vs</strong>

                    <div class="match-team">
                        ${awayLogo ? `<img src="${lpEscapeHtml(awayLogo)}" alt="${lpEscapeHtml(away)}">` : ""}
                        <span>${lpEscapeHtml(away)}</span>
                    </div>
                </div>

                <div class="match-meta">
                    ${date ? `<small>${lpEscapeHtml(lpFormatDate(date))}</small>` : ""}
                    ${status ? `<small>${lpEscapeHtml(status)}</small>` : ""}
                </div>
            </div>
        `;
    }).join("");
}

function lpNewsHTML(news) {
    const items = Array.isArray(news) ? news : [];

    if (!items.length) return `<div class="empty-state">No news yet.</div>`;

    return items.map(item => {
        const title = item.title || item.name || "Untitled";
        const source = item.source || item.publisher || "";
        const url = item.url || item.link || "#";

        return `
            <a class="news-item" href="${lpEscapeHtml(url)}" target="_blank" rel="noopener noreferrer">
                <strong>${lpEscapeHtml(title)}</strong>
                ${source ? `<small>${lpEscapeHtml(source)}</small>` : ""}
            </a>
        `;
    }).join("");
}

/* =====================================================
   UI STATES
===================================================== */

function lpShowLoading() {
    LEAGUE_PAGE_STATE.loading = true;

    lpSetText("#leagueName", "Loading");
    lpSetText("#leagueCountry", "");
    lpSetHTML("#featuredMatch", lpLoadingMarkup("featured-match"));
    lpSetHTML("#topScorer", lpLoadingMarkup("top-scorer"));
    lpSetHTML("#matchesList", lpLoadingMarkup("matches"));
    lpSetHTML("#standingsTable", lpLoadingMarkup("standings"));

    const newsCard = document.querySelector("#news .card");
    if (newsCard) {
        newsCard.innerHTML = `
            <h2>News</h2>
            <div class="empty-state">Loading news...</div>
        `;
    }
}

function lpShowLeaguePrompt() {
    document.title = "Select a league | Scout wave";

    lpSetText("#leagueName", "Select a league");
    lpSetText("#leagueCountry", "Open a league from the menu");
    lpSetImage("#leagueLogo", "", "League logo");

    lpShowEmpty("featuredMatch", "Choose a league to view featured match");
    lpShowEmpty("topScorer", "Choose a league to view top scorers");
    lpShowEmpty("matchesList", "Choose a league to view fixtures");
    lpShowEmpty("standingsTable", "Choose a league to view standings", 8);

    const newsCard = document.querySelector("#news .card");
    if (newsCard) {
        newsCard.innerHTML = `
            <h2>News</h2>
            <div class="empty-state">Choose a league to view news</div>
        `;
    }
}

function lpShowSeasonPrompt() {
    document.title = "Select a season | Scout wave";
    lpShowEmpty("standingsTable", "Select a season to continue", 8);
    lpShowEmpty("matchesList", "Select a season to continue");
    lpShowEmpty("topScorer", "Select a season to continue");
}

/* =====================================================
   API LOADERS
===================================================== */

async function lpLoadLeagueMeta(leagueId, season) {
    const api = lpGetAPI();
    if (!api?.getLeague) throw new Error("API.getLeague is missing");

    const data = await api.getLeague(leagueId, season);
    return data?.response?.[0] || null;
}

async function lpLoadStandings(leagueId, season) {
    const api = lpGetAPI();
    if (!api?.getStandings) throw new Error("API.getStandings is missing");

    const data = await api.getStandings(leagueId, season);
    return data?.response?.[0]?.league?.standings || [];
}

async function lpLoadFixtures(leagueId, season) {
    const api = lpGetAPI();
    if (!api?.getFixtures) throw new Error("API.getFixtures is missing");

    const data = await api.getFixtures(leagueId, season);
    return data?.response || [];
}

async function lpLoadTopScorers(leagueId, season) {
    const api = lpGetAPI();
    if (!api?.getTopScorers) throw new Error("API.getTopScorers is missing");

    const data = await api.getTopScorers(leagueId, season);
    return data?.response || [];
}

/* =====================================================
   APPLY DATA
===================================================== */

function lpApplyMeta(apiLeague, context, season, fixtures = [], standings = []) {
    const leagueName = apiLeague?.league?.name || context?.league?.name || context?.name || "Loading";
    const countryName = apiLeague?.country?.name || context?.country?.name || context?.country?.country || context?.country || "";
    const logo = apiLeague?.league?.logo || context?.league?.logo || context?.league?.icon || context?.icon || context?.flag || "";

    document.title = `${leagueName} | Beelooo`;

    lpSetText("#leagueName", leagueName);
    lpSetText("#leagueCountry", countryName);
    lpSetImage("#leagueLogo", logo, leagueName);

    const seasonYear =
        season ||
        context?.season ||
        apiLeague?.seasons?.find(s => s.current)?.year ||
        "-";

    const teamCount = lpGetStandingRows(standings).length || "-";
    const currentRound =
        fixtures?.find(f => f?.league?.round)?.league?.round ||
        fixtures?.[0]?.league?.round ||
        apiLeague?.league?.round ||
        "-";

    lpSetText("#teamCount", teamCount);
    lpSetText("#matchday", currentRound);
    lpSetText("#seasonYear", seasonYear);
    lpSetText("#lastUpdated", lpFormatDate(new Date()));

    initLeagueFavouriteButton();
}

function lpApplyContent({ standings, fixtures, scorers }) {
    const featured =
        (fixtures || []).find(f => ["NS", "TBD", "PST", "SUSP", "INT", "LIVE", "HT", "1H", "2H"].includes(f?.fixture?.status?.short)) ||
        (fixtures || [])[0] ||
        null;

    const topScorer = Array.isArray(scorers) ? scorers[0] : null;

    lpSetHTML("#featuredMatch", lpFeaturedMatchHTML(featured));
    lpSetHTML("#topScorer", lpTopScorerHTML(topScorer));
    lpSetHTML("#standingsTable", lpStandingsHTML(standings));
    lpSetHTML("#matchesList", lpMatchesHTML((fixtures || []).slice(0, 15)));

    const newsCard = document.querySelector("#news .card");
    if (newsCard) {
        newsCard.innerHTML = `
            <h2>News</h2>
            <div class="empty-state">News will be added later.</div>
        `;
    }
}

/* =====================================================
   LEAGUE FAVOURITES
===================================================== */

function getLeagueFavourites() {
    try {
        return JSON.parse(localStorage.getItem(LEAGUE_FAVOURITES_KEY)) || [];
    } catch {
        return [];
    }
}

function saveLeagueFavourites(data) {
    localStorage.setItem(LEAGUE_FAVOURITES_KEY, JSON.stringify(data));
}

function isLeagueFavourite(id) {
    return getLeagueFavourites().some(item => String(item.id) === String(id));
}

function getCurrentLeague() {
    const context = lpGetStoredContext();
    if (!context) return null;

    return {
        id: context.id,
        slug: context.slug,
        name: context.name || context.league?.name || "",
        country: context.country?.name || context.country || "",
        logo: context.icon || context.league?.logo || ""
    };
}

function toggleLeagueFavourite(league) {
    if (!league) return false;

    const favourites = getLeagueFavourites();
    const index = favourites.findIndex(item => String(item.id) === String(league.id));

    let active;

    if (index > -1) {
        favourites.splice(index, 1);
        active = false;
    } else {
        favourites.unshift({
            id: league.id,
            slug: league.slug,
            name: league.name,
            country: league.country,
            logo: league.logo
        });
        active = true;
    }

    saveLeagueFavourites(favourites);

    window.dispatchEvent(new CustomEvent("leagueFavouriteChanged"));

    return active;
}

function initLeagueFavouriteButton() {
    const btn = document.querySelector(".fav-btn");
    if (!btn) return;

    const currentLeague = getCurrentLeague();
    if (!currentLeague) return;

    btn.classList.toggle("active", isLeagueFavourite(currentLeague.id));

    if (btn.dataset.initialized) return;
    btn.dataset.initialized = "true";

    btn.addEventListener("click", () => {
        const league = getCurrentLeague();
        if (!league) return;

        const active = toggleLeagueFavourite(league);
        btn.classList.toggle("active", active);
    }, { signal: LEAGUE_PAGE_STATE.controller?.signal });
}

function loadFavouriteLeagues() {
    const wrapper = document.getElementById("favouritesContainer");
    if (!wrapper) return;

    const favourites = getLeagueFavourites();

    if (!favourites.length) {
        wrapper.innerHTML = `
            <div class="empty-state">
                No favourite leagues yet.
            </div>
        `;
        return;
    }

    wrapper.innerHTML = favourites.map(item => `
        <button
            class="favourite-league-card"
            data-slug="${lpEscapeHtml(item.slug)}">
            <img
                src="${lpEscapeHtml(item.logo)}"
                alt="${lpEscapeHtml(item.name)}"
                loading="lazy">
            <div class="favourite-league-info">
                <strong>${lpEscapeHtml(item.name)}</strong>
                <small>${lpEscapeHtml(item.country)}</small>
            </div>
        </button>
    `).join("");
}

function destroyFavouritesPage() {
    if (!FAVOURITES_PAGE_STATE.active) return;

    FAVOURITES_PAGE_STATE.controller?.abort();
    FAVOURITES_PAGE_STATE.controller = null;
    FAVOURITES_PAGE_STATE.active = false;
}

function initFavouritesPage() {
    const wrapper = document.getElementById("favouritesContainer");
    if (!wrapper) {
        destroyFavouritesPage();
        return;
    }

    if (FAVOURITES_PAGE_STATE.active) {
        loadFavouriteLeagues();
        return;
    }

    destroyFavouritesPage();

    FAVOURITES_PAGE_STATE.active = true;
    FAVOURITES_PAGE_STATE.controller = new AbortController();

    const { signal } = FAVOURITES_PAGE_STATE.controller;

    document.addEventListener("click", e => {
        const card = e.target.closest(".favourite-league-card");
        if (!card) return;

        const slug = card.dataset.slug;
        if (!slug) return;

        if (typeof window.navigate === "function") {
            window.navigate(`/league-page/${slug}`);
        } else {
            location.href = `/league-page/${slug}`;
        }
    }, { signal });

    loadFavouriteLeagues();
}

function handleLeagueFavouriteChanged() {
    if (lpIsLeagueRoute(lpCurrentPath())) {
        initLeagueFavouriteButton();
    }

    if (lpIsFavouritesRoute(lpCurrentPath())) {
        loadFavouriteLeagues();
    }
}

if (!window.__leagueFavouriteChangedBound) {
    window.__leagueFavouriteChangedBound = true;
    window.addEventListener("leagueFavouriteChanged", handleLeagueFavouriteChanged);
}

/* =====================================================
   MAIN REFRESH
===================================================== */

async function lpRefresh() {
    const currentToken = ++LEAGUE_PAGE_STATE.requestToken;
    const slug = lpGetPathSlug();
    const stored = lpGetStoredContext();
    const season = lpGetSeasonFromSelect();

    if (!slug && !stored) {
        lpShowLeaguePrompt();
        LEAGUE_PAGE_STATE.loading = false;
        return;
    }

    lpShowLoading();
    await new Promise(resolve => requestAnimationFrame(resolve));

    try {
        let context = stored;

        if (!context || String(context.slug || "").toLowerCase() !== slug) {
            const found = await lpFindLeagueBySlug(slug);
            if (!found) {
                lpShowLeaguePrompt();
                LEAGUE_PAGE_STATE.loading = false;
                return;
            }

            context = {
                slug,
                id: found.league.id,
                name: found.league.name,
                icon: found.league.icon,
                country: {
                    name: found.country.country,
                    code: found.country.code,
                    flag: found.country.flag
                },
                league: {
                    id: found.league.id,
                    name: found.league.name,
                    logo: found.league.icon,
                    icon: found.league.icon
                },
                season
            };

            lpSaveContext(context);
        }

        if (!season) {
            lpShowSeasonPrompt();
            LEAGUE_PAGE_STATE.loading = false;
            return;
        }

        const leagueId = Number(context.id || context.league?.id);
        if (!Number.isFinite(leagueId)) {
            throw new Error("Invalid league id");
        }

        const [apiLeagueResult, standingsResult, fixturesResult, scorersResult] = await Promise.allSettled([
            lpLoadLeagueMeta(leagueId, season),
            lpLoadStandings(leagueId, season),
            lpLoadFixtures(leagueId, season),
            lpLoadTopScorers(leagueId, season)
        ]);

        if (currentToken !== LEAGUE_PAGE_STATE.requestToken) return;

        const apiLeague = apiLeagueResult.status === "fulfilled" ? apiLeagueResult.value : null;
        const standings = standingsResult.status === "fulfilled" ? standingsResult.value : [];
        const fixtures = fixturesResult.status === "fulfilled" ? fixturesResult.value : [];
        const scorers = scorersResult.status === "fulfilled" ? scorersResult.value : [];

        lpApplyMeta(apiLeague, context, season, fixtures, standings);
        lpApplyContent({ standings, fixtures, scorers });

        lpSaveContext({
            ...context,
            season
        });
    } catch (err) {
        if (currentToken !== LEAGUE_PAGE_STATE.requestToken) return;

        console.error("League page load error:", err);

        lpSetText("#leagueName", "Failed to load");
        lpSetText("#leagueCountry", "Unable to load league");
        lpSetImage("#leagueLogo", "", "League logo");
        lpShowEmpty("featuredMatch", "Unable to load league data.");
        lpShowEmpty("topScorer", "Unable to load league data.");
        lpShowEmpty("matchesList", "Unable to load league data.");
        lpShowEmpty("standingsTable", "Unable to load standings.", 8);

        const newsCard = document.querySelector("#news .card");
        if (newsCard) {
            newsCard.innerHTML = `
                <h2>News</h2>
                <div class="empty-state">Unable to load news.</div>
            `;
        }
    } finally {
        if (currentToken === LEAGUE_PAGE_STATE.requestToken) {
            LEAGUE_PAGE_STATE.loading = false;
        }
    }
}

/* =====================================================
   EVENTS
===================================================== */

function lpBindEvents(signal) {
    document.addEventListener("click", (e) => {
        const tabBtn = e.target.closest(".tab");
        if (tabBtn && tabBtn.dataset.tab) {
            document.querySelector(".tab.active")?.classList.remove("active");
            tabBtn.classList.add("active");

            document.querySelector(".page.active")?.classList.remove("active");
            document.getElementById(tabBtn.dataset.tab)?.classList.add("active");
            return;
        }

        const backBtn = e.target.closest(".back-btn");
        if (backBtn) {
            e.preventDefault();
            lpNavigate("/leagues");
            return;
        }

        const favBtn = e.target.closest(".fav-btn");
        if (favBtn) {
            const league = getCurrentLeague();
            if (!league) return;

            const active = toggleLeagueFavourite(league);
            favBtn.classList.toggle("active", active);
        }
    }, { signal });

    document.addEventListener("change", async (e) => {
        if (e.target && e.target.id === "seasonSelect") {
            const current = lpGetStoredContext();
            if (current) {
                current.season = lpGetSeasonFromSelect();
                lpSaveContext(current);
            }
            await lpRefresh();
        }
    }, { signal });
}

function destroyLeaguePage() {
    LEAGUE_PAGE_STATE.requestToken++;
    LEAGUE_PAGE_STATE.loading = false;
    LEAGUE_PAGE_STATE.active = false;
    LEAGUE_PAGE_STATE.slug = null;

    LEAGUE_PAGE_STATE.controller?.abort();
    LEAGUE_PAGE_STATE.controller = null;
}

function initLeaguePage() {
    const path = lpCurrentPath();

    if (!lpIsLeagueRoute(path)) {
        destroyLeaguePage();
        return;
    }

    const slug = lpGetPathSlug();

    if (LEAGUE_PAGE_STATE.active && LEAGUE_PAGE_STATE.slug === slug) {
        initLeagueFavouriteButton();
        void lpRefresh();
        return;
    }

    destroyLeaguePage();

    LEAGUE_PAGE_STATE.active = true;
    LEAGUE_PAGE_STATE.slug = slug;
    LEAGUE_PAGE_STATE.controller = new AbortController();

    lpBindEvents(LEAGUE_PAGE_STATE.controller.signal);

    document.querySelector(".tab.active")?.classList.remove("active");
    document.querySelector('.tab[data-tab="overview"]')?.classList.add("active");

    document.querySelector(".page.active")?.classList.remove("active");
    document.getElementById("overview")?.classList.add("active");

    void lpRefresh();
}

/* =====================================================
   FAVOURITES PAGE BOOT
===================================================== */

function bootLeagueModule() {
    const path = lpCurrentPath();

    if (lpIsLeagueRoute(path)) {
        initLeaguePage();
        destroyFavouritesPage();
        return;
    }

    if (lpIsFavouritesRoute(path)) {
        destroyLeaguePage();
        initFavouritesPage();
        return;
    }

    destroyLeaguePage();
    destroyFavouritesPage();
}

/* =====================================================
   REGISTRATION + BOOT
===================================================== */

window.router?.registerPage?.("LeaguePage", {
    init: initLeaguePage,
    destroy: destroyLeaguePage
});

window.router?.registerPage?.("FavouritesPage", {
    init: initFavouritesPage,
    destroy: destroyFavouritesPage
});

document.addEventListener("pageLoaded", bootLeagueModule);
document.addEventListener("pageRefreshed", bootLeagueModule);
window.addEventListener("beforeunload", () => {
    destroyLeaguePage();
    destroyFavouritesPage();
});

bootLeagueModule();