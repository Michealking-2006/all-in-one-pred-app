/**
 *********************
 * LEAGUE PAGE
 * SPA SAFE
 *********************
 */

let LEAGUE_PAGE_CACHE = null;
let LEAGUE_PAGE_EVENTS_BOUND = false;
let LEAGUE_PAGE_LOADING = false;

/* =========================================== SAFE HELPERS =========================================== */

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
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function lpSetText(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text ?? "";
}

function lpSetHTML(selector, html) {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = html;
}

function lpSetImage(selector, src, alt = "") {
    const el = document.querySelector(selector);
    if (!el) return;
    if (src) el.src = src;
    if (alt) el.alt = alt;
}

function lpNavigate(path) {
    if (typeof window.navigate === "function") {
        window.navigate(path);
        return;
    }

    history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
}

function lpGetPathSlug() {
    const parts = location.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("league-page");
    if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]).toLowerCase();
    return "";
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

function lpSetSeasonSelect(year) {
    const select = document.getElementById("seasonSelect");
    if (!select || !year) return;

    const idx = [...select.options].findIndex(opt => (opt.textContent || "").trim().startsWith(String(year)));
    if (idx >= 0) select.selectedIndex = idx;
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

function lpClearIfEmpty(targetId) {
    const el = document.getElementById(targetId);
    if (el && el.querySelector(".empty-state")) el.innerHTML = "";
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

/* =========================================== ROUTING / CONTEXT =========================================== */

function lpGetContext() {
    const stored = lpGetStoredContext();
    const slug = lpGetPathSlug();
    const season = lpGetSeasonFromSelect();

    if (stored && stored.slug) {
        return {
            ...stored,
            season: season ?? stored.season ?? null
        };
    }

    return {
        slug,
        season
    };
}

/* =========================================== RENDER HELPERS =========================================== */

function lpSkeletonList(count = 8) {
    return Array.from({ length: count }, () => `
        <div class="league-card skeleton-card">
            <div class="league-link">
                <div class="skeleton skeleton-icon"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-star"></div>
            </div>
        </div>
    `).join("");
}

function lpFeaturedMatchHTML(match) {
    
    if (!match) {
        return `<div class="empty-state">No featured match yet.</div>`;
    }
    
    const fixture = match.fixture || {};
    const league = match.league || {};
    const teams = match.teams || {};
    const goals = match.goals || {};
    
    const home = teams.home?.name || "Home";
    const away = teams.away?.name || "Away";
    
    const homeLogo = teams.home?.logo || "";
    const awayLogo = teams.away?.logo || "";
    
    const leagueName = league.name || "";
    const leagueLogo = league.logo || "";
    
    const venue = fixture.venue?.name || "";
    const city = fixture.venue?.city || "";
    const referee = fixture.referee || "";
    const round = league.round || "";
    
    const statusShort = fixture.status?.short || "";
    const statusLong = fixture.status?.long || "";
    
    const date = fixture.date ? new Date(fixture.date) : null;
    
    const matchDate = date ?
        date.toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        }) :
        "";
    
    const matchTime = date ?
        date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        }) :
        "";
    
    const homeGoals = goals.home;
    const awayGoals = goals.away;
    
    const played =
        homeGoals !== null &&
        homeGoals !== undefined &&
        awayGoals !== null &&
        awayGoals !== undefined;
    
    const statusClass = (
            statusShort === "LIVE" ||
            statusShort === "1H" ||
            statusShort === "2H"
        ) ?
        "live" :
        (
            statusShort === "FT" ?
            "finished" :
            (
                statusShort === "HT" ?
                "halftime" :
                "upcoming"
            )
        );
    
    return `

<div class="featured-match">

    <div class="featured-top">

        <div class="featured-league">

            ${
                leagueLogo
                ? `
                <img
                    src="${lpEscapeHtml(leagueLogo)}"
                    alt="${lpEscapeHtml(leagueName)}"
                >
                `
                : ""
            }

            <span>${lpEscapeHtml(leagueName)}</span>

        </div>

        <div class="match-status ${statusClass}">
            ${lpEscapeHtml(statusLong || statusShort)}
        </div>

    </div>

    <div class="featured-date">

        ${
            matchDate
            ? `
            <span>${lpEscapeHtml(matchDate)}</span>
            `
            : ""
        }

        ${
            matchTime
            ? `
            <span>${lpEscapeHtml(matchTime)}</span>
            `
            : ""
        }

    </div>

    <div class="featured-teams">

        <div class="featured-team">

            ${
                homeLogo
                ? `
                <img
                    src="${lpEscapeHtml(homeLogo)}"
                    alt="${lpEscapeHtml(home)}"
                >
                `
                : ""
            }

            <strong>${lpEscapeHtml(home)}</strong>

        </div>

        <div class="featured-score">

            ${
                played
                ? `
                <span>${homeGoals}</span>
                <small>-</small>
                <span>${awayGoals}</span>
                `
                : `
                <span>VS</span>
                `
            }

        </div>

        <div class="featured-team">

            ${
                awayLogo
                ? `
                <img
                    src="${lpEscapeHtml(awayLogo)}"
                    alt="${lpEscapeHtml(away)}"
                >
                `
                : ""
            }

            <strong>${lpEscapeHtml(away)}</strong>

        </div>

    </div>

    <div class="featured-bottom">

        ${
            venue
            ? `
            <div>
                <strong>Stadium</strong>
                <span>${lpEscapeHtml(venue)}</span>
            </div>
            `
            : ""
        }

        ${
            city
            ? `
            <div>
                <strong>City</strong>
                <span>${lpEscapeHtml(city)}</span>
            </div>
            `
            : ""
        }

        ${
            round
            ? `
            <div>
                <strong>Round</strong>
                <span>${lpEscapeHtml(round)}</span>
            </div>
            `
            : ""
        }

        ${
            referee
            ? `
            <div>
                <strong>Referee</strong>
                <span>${lpEscapeHtml(referee)}</span>
            </div>
            `
            : ""
        }

    </div>

</div>

`;
    
}



/**function lpTopScorerHTML(scorer) {
    if (!scorer) return `<div class="empty-state">No top scorer yet.</div>`;

    const player = scorer.player || scorer;
    const stat = scorer.statistics?.[0] || scorer.statistics?.[0] || {};
    const name = player.name || scorer.name || "Unknown";
    const team = stat.team?.name || scorer.team?.name || "";
    const goals = stat.goals?.total ?? scorer.goals ?? scorer.score ?? 0;
    const image = player.photo || scorer.photo || scorer.image || scorer.avatar || "";

    return `
        <div class="top-scorer">
            ${image ? `<img src="${lpEscapeHtml(image)}" alt="${lpEscapeHtml(name)}">` : ""}
            <div>
                <strong>${lpEscapeHtml(name)}</strong>
                ${team ? `<p>${lpEscapeHtml(team)}</p>` : ""}
                <small>${lpEscapeHtml(goals)} goals</small>
            </div>
        </div>
    `;
}**/

function lpTopScorerHTML(scorer) {
    
    if (!scorer) {
        return `<div class="empty-state">No top scorer yet.</div>`;
    }
    
    const player = scorer.player || scorer;
    const stat = scorer.statistics?.[0] || {};
    
    /* -----------------------------
       Player
    ------------------------------ */
    
    const name =
        player.name ||
        scorer.name ||
        "Unknown";
    
    const image =
        player.photo ||
        scorer.photo ||
        scorer.image ||
        scorer.avatar ||
        "";
    
    /* -----------------------------
       Club
    ------------------------------ */
    
    const team =
        stat.team?.name ||
        scorer.team?.name ||
        "";
    
    const teamLogo =
        stat.team?.logo ||
        scorer.team?.logo ||
        "";
    
    /* -----------------------------
       Position
    ------------------------------ */
    
    const fullPosition =
        stat.games?.position ||
        player.position ||
        scorer.position ||
        "";
    
    const POSITION_MAP = {
        
        "Goalkeeper": "GK",
        
        "Defender": "DEF",
        "Centre-Back": "CB",
        "Center Back": "CB",
        "Right-Back": "RB",
        "Left-Back": "LB",
        "Wing-Back": "WB",
        
        "Midfielder": "MID",
        "Defensive Midfielder": "CDM",
        "Central Midfielder": "CM",
        "Attacking Midfielder": "CAM",
        "Right Midfielder": "RM",
        "Left Midfielder": "LM",
        
        "Forward": "FW",
        "Centre-Forward": "CF",
        "Center Forward": "CF",
        "Striker": "ST",
        "Second Striker": "SS",
        "Right Winger": "RW",
        "Left Winger": "LW"
        
    };
    
    const shortPosition =
        POSITION_MAP[fullPosition] ||
        fullPosition;
    
    /* -----------------------------
       Bio
    ------------------------------ */
    
    const nationality =
        player.nationality ||
        scorer.nationality ||
        "";
    
    const age =
        player.age ||
        scorer.age ||
        "";
    
    let height =
        player.height ||
        scorer.height ||
        "";
    
    let weight =
        player.weight ||
        scorer.weight ||
        "";
    
    if (height && !/cm/i.test(height)) {
        height += " cm";
    }
    
    if (weight && !/kg/i.test(weight)) {
        weight += " kg";
    }
    
    /* -----------------------------
       Football Stats
    ------------------------------ */
    
    const goals =
        stat.goals?.total ??
        scorer.goals ??
        scorer.score ??
        0;
    
    const assists =
        stat.goals?.assists ??
        scorer.assists ??
        "-";
    
    const appearances =
        stat.games?.appearences ??
        stat.games?.appearances ??
        scorer.appearances ??
        "-";
    
    const rating =
        stat.games?.rating ??
        scorer.rating ??
        "-";
    
    return `

<div class="top-scorer">

    <div class="top-scorer-image">

        ${
            teamLogo
            ? `
            <div class="club-badge">
                <img
                    src="${lpEscapeHtml(teamLogo)}"
                    alt="${lpEscapeHtml(team)}"
                >
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
            : `
            <div class="skeleton skeleton-avatar"></div>
            `
        }

        ${
            shortPosition
            ? `
            <div class="position-badge">
                ${lpEscapeHtml(shortPosition)}
            </div>
            `
            : ""
        }

    </div>

    <div class="top-scorer-text">

        <strong>${lpEscapeHtml(name)}</strong>

        ${
            team
            ? `<p>${lpEscapeHtml(team)}</p>`
            : ""
        }

        ${
            nationality
            ? `
            <small>
                <span>Nationality</span>
                <span>${lpEscapeHtml(nationality)}</span>
            </small>
            `
            : ""
        }

        ${
            fullPosition
            ? `
            <small>
                <span>Position</span>
                <span>${lpEscapeHtml(fullPosition)}</span>
            </small>
            `
            : ""
        }

        ${
            age
            ? `
            <small>
                <span>Age</span>
                <span>${lpEscapeHtml(age)} yrs</span>
            </small>
            `
            : ""
        }

        ${
            height
            ? `
            <small>
                <span>Height</span>
                <span>${lpEscapeHtml(height)}</span>
            </small>
            `
            : ""
        }

        ${
            weight
            ? `
            <small>
                <span>Weight</span>
                <span>${lpEscapeHtml(weight)}</span>
            </small>
            `
            : ""
        }

        <small>
            <span>Appearances</span>
            <span>${lpEscapeHtml(appearances)}</span>
        </small>

        <small>
            <span>Assists</span>
            <span>${lpEscapeHtml(assists)}</span>
        </small>

        <small>
            <span>Rating</span>
            <span>${lpEscapeHtml(rating)}</span>
        </small>

        <small class="goals-row">
            <span>Goals</span>
            <span>${lpEscapeHtml(goals)}</span>
        </small>

    </div>

</div>

`;
    
}function lpTopScorerHTML(scorer) {
    
    if (!scorer) {
        return `<div class="empty-state">No top scorer yet.</div>`;
    }
    
    const player = scorer.player || scorer;
    const stat = scorer.statistics?.[0] || {};
    
    /* -----------------------------
       Player
    ------------------------------ */
    
    const name =
        player.name ||
        scorer.name ||
        "Unknown";
    
    const image =
        player.photo ||
        scorer.photo ||
        scorer.image ||
        scorer.avatar ||
        "";
    
    /* -----------------------------
       Club
    ------------------------------ */
    
    const team =
        stat.team?.name ||
        scorer.team?.name ||
        "";
    
    const teamLogo =
        stat.team?.logo ||
        scorer.team?.logo ||
        "";
    
    /* -----------------------------
       Position
    ------------------------------ */
    
    const fullPosition =
        stat.games?.position ||
        player.position ||
        scorer.position ||
        "";
    
    const POSITION_MAP = {
        
        "Goalkeeper": "GK",
        
        "Defender": "DEF",
        "Centre-Back": "CB",
        "Center Back": "CB",
        "Right-Back": "RB",
        "Left-Back": "LB",
        "Wing-Back": "WB",
        
        "Midfielder": "MID",
        "Defensive Midfielder": "CDM",
        "Central Midfielder": "CM",
        "Attacking Midfielder": "CAM",
        "Right Midfielder": "RM",
        "Left Midfielder": "LM",
        
        "Forward": "FW",
        "Centre-Forward": "CF",
        "Center Forward": "CF",
        "Striker": "ST",
        "Second Striker": "SS",
        "Right Winger": "RW",
        "Left Winger": "LW"
        
    };
    
    const shortPosition =
        POSITION_MAP[fullPosition] ||
        fullPosition;
    
    /* -----------------------------
       Bio
    ------------------------------ */
    
    const nationality =
        player.nationality ||
        scorer.nationality ||
        "";
    
    const age =
        player.age ||
        scorer.age ||
        "";
    
    let height =
        player.height ||
        scorer.height ||
        "";
    
    let weight =
        player.weight ||
        scorer.weight ||
        "";
    
    if (height && !/cm/i.test(height)) {
        height += " cm";
    }
    
    if (weight && !/kg/i.test(weight)) {
        weight += " kg";
    }
    
    /* -----------------------------
       Football Stats
    ------------------------------ */
    
    const goals =
        stat.goals?.total ??
        scorer.goals ??
        scorer.score ??
        0;
    
    const assists =
        stat.goals?.assists ??
        scorer.assists ??
        "-";
    
    const appearances =
        stat.games?.appearences ??
        stat.games?.appearances ??
        scorer.appearances ??
        "-";
    
    const rating =
        stat.games?.rating ??
        scorer.rating ??
        "-";
    
    return `

<div class="top-scorer">

    <div class="top-scorer-image">

        ${
            teamLogo
            ? `
            <div class="club-badge">
                <img
                    src="${lpEscapeHtml(teamLogo)}"
                    alt="${lpEscapeHtml(team)}"
                >
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
            : `
            <div class="skeleton skeleton-avatar"></div>
            `
        }

        ${
            shortPosition
            ? `
            <div class="position-badge">
                ${lpEscapeHtml(shortPosition)}
            </div>
            `
            : ""
        }

    </div>

    <div class="top-scorer-text">

        <strong>${lpEscapeHtml(name)}</strong>

        ${
            team
            ? `<p>${lpEscapeHtml(team)}</p>`
            : ""
        }

        ${
            nationality
            ? `
            <small>
                <span>Nationality</span>
                <span>${lpEscapeHtml(nationality)}</span>
            </small>
            `
            : ""
        }

        ${
            fullPosition
            ? `
            <small>
                <span>Position</span>
                <span>${lpEscapeHtml(fullPosition)}</span>
            </small>
            `
            : ""
        }

        ${
            age
            ? `
            <small>
                <span>Age</span>
                <span>${lpEscapeHtml(age)} yrs</span>
            </small>
            `
            : ""
        }

        ${
            height
            ? `
            <small>
                <span>Height</span>
                <span>${lpEscapeHtml(height)}</span>
            </small>
            `
            : ""
        }

        ${
            weight
            ? `
            <small>
                <span>Weight</span>
                <span>${lpEscapeHtml(weight)}</span>
            </small>
            `
            : ""
        }

        <small>
            <span>Appearances</span>
            <span>${lpEscapeHtml(appearances)}</span>
        </small>

        <small>
            <span>Assists</span>
            <span>${lpEscapeHtml(assists)}</span>
        </small>

        <small>
            <span>Rating</span>
            <span>${lpEscapeHtml(rating)}</span>
        </small>

        <small class="goals-row">
            <span>Goals</span>
            <span>${lpEscapeHtml(goals)}</span>
        </small>

    </div>

</div>

`;
    
}

function lpStandingsHTML(standings) {
    const rows = Array.isArray(standings?.[0]) ? standings[0] : (Array.isArray(standings) ? standings : []);

    if (!rows.length) {
        return `
            <tr>
                <td colspan="8"><div class="empty-state">No standings available.</div></td>
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
        return `<div class="empty-state">No upcoming matches.</div>`;
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

function lpTeamsHTML(teams) {
    const items = Array.isArray(teams) ? teams : [];

    if (!items.length) {
        return `<div class="empty-state">No teams available.</div>`;
    }

    return items.map(item => {
        const team = item.team || item;
        const name = team.name || item.name || "Unknown";
        const logo = team.logo || item.logo || "";

        return `
            <div class="team-card">
                ${logo ? `<img src="${lpEscapeHtml(logo)}" alt="${lpEscapeHtml(name)}">` : ""}
                <span>${lpEscapeHtml(name)}</span>
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

/* =========================================== UI STATES =========================================== */

function lpShowLoading() {
    if (LEAGUE_PAGE_LOADING) return;
    LEAGUE_PAGE_LOADING = true;

    lpSetText("#leagueName", "Loading");
    lpSetText("#leagueCountry", "");
    lpSetText("#teamCount", "-");
    lpSetText("#matchday", "-");
    lpSetText("#seasonYear", "-");
    lpSetText("#lastUpdated", "-");

    lpSetHTML("#featuredMatch", `<div class="empty-state">Loading featured match...</div>`);
    lpSetHTML("#topScorer", `<div class="empty-state">Loading top scorer...</div>`);
    lpSetHTML("#matchesList", `<div class="empty-state">Loading matches...</div>`);
    lpSetHTML("#teamsGrid", `<div class="empty-state">Loading teams...</div>`);
    lpSetHTML("#standingsTable", "");

    const newsCard = document.querySelector("#news .card");
    if (newsCard) {
        newsCard.innerHTML = `
            <h2>News</h2>
            <div class="empty-state">Loading news...</div>
        `;
    }
}

function lpShowLeaguePrompt() {
    document.title = "Select a league | ";

    lpSetText("#leagueName", "Select a league");
    lpSetText("#leagueCountry", "Open a league from the menu");
    lpSetImage("#leagueLogo", "", "League logo");
    lpSetText("#teamCount", "-");
    lpSetText("#matchday", "-");
    lpSetText("#seasonYear", "");
    lpSetText("#lastUpdated", "-");

    lpShowEmpty("featuredMatch", "Choose a league to view featured match");
    lpShowEmpty("topScorer", "Choose a league to view top scorers");
    lpShowEmpty("matchesList", "Choose a league to view fixtures");
    lpShowEmpty("teamsGrid", "Choose a league to view teams");
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
    document.title = "Select a season | ";
    lpShowEmpty("standingsTable", "Select a season to continue", 8);
    lpShowEmpty("teamsGrid", "Select a season to continue");
    lpShowEmpty("matchesList", "Select a season to continue");
    lpShowEmpty("topScorer", "Select a season to continue");
}

/* =========================================== API LOADERS =========================================== */

async function lpLoadLeagueMeta(leagueId, season) {
    if (!window.API?.getLeague) throw new Error("API.getLeague is missing");
    const data = await API.getLeague(leagueId, season);
    return data?.response?.[0] || null;
}

async function lpLoadStandings(leagueId, season) {
    if (!window.API?.getStandings) throw new Error("API.getStandings is missing");
    const data = await API.getStandings(leagueId, season);
    return data?.response?.[0]?.league?.standings || [];
}

async function lpLoadTeams(leagueId, season) {
    if (!window.API?.getTeams) throw new Error("API.getTeams is missing");
    const data = await API.getTeams(leagueId, season);
    return data?.response || [];
}

async function lpLoadFixtures(leagueId, season) {
    if (!window.API?.getFixtures) throw new Error("API.getFixtures is missing");
    const data = await API.getFixtures(leagueId, season);
    return data?.response || [];
}

async function lpLoadTopScorers(leagueId, season) {
    if (!window.API?.getTopScorers) throw new Error("API.getTopScorers is missing");
    const data = await API.getTopScorers(leagueId, season);
    return data?.response || [];
}

/* =========================================== APPLY DATA =========================================== */

function lpApplyMeta(apiLeague, context, season) {
    const leagueName = apiLeague?.league?.name || context?.league?.name || context?.name || "Loading";
    const countryName = apiLeague?.country?.name || context?.country?.country || context?.country?.name || context?.country || "";
    const logo = apiLeague?.league?.logo || context?.league?.logo || context?.league?.icon || context?.icon || context?.flag || "";

    document.title = `${leagueName} | `;

    lpSetText("#leagueName", leagueName);
    lpSetText("#leagueCountry", countryName);
    lpSetImage("#leagueLogo", logo, leagueName);

    const currentRound =
        apiLeague?.league?.currentRound ||
        apiLeague?.league?.currentMatchday ||
        apiLeague?.currentRound ||
        apiLeague?.currentMatchday ||
        "-";

    const seasonYear =
        apiLeague?.seasons?.find(s => s.current)?.year ||
        season ||
        context?.season ||
        "-";

    const teamCount =
    teams.length ||
    context?.league?.teamCount ||
    context?.teamCount ||
    "-";

    lpSetText("#teamCount", teamCount);
    lpSetText("#matchday", currentRound);
    lpSetText("#seasonYear", seasonYear);
    lpSetText("#lastUpdated", lpFormatDate(new Date()));

    if (seasonYear && seasonYear !== "-") lpSetSeasonSelect(seasonYear);
}

function lpApplyContent({ standings, teams, fixtures, scorers }) {
    const featured = Array.isArray(fixtures) ? fixtures[0] : null;
    const topScorer = Array.isArray(scorers) ? scorers[0] : null;

    lpSetHTML("#featuredMatch", lpFeaturedMatchHTML(featured));
    lpSetHTML("#topScorer", lpTopScorerHTML(topScorer));
    lpSetHTML("#standingsTable", lpStandingsHTML(standings));
    lpSetHTML("#matchesList", lpMatchesHTML((fixtures || []).slice(0, 15)));
    lpSetHTML("#teamsGrid", lpTeamsHTML(teams));

    const newsCard = document.querySelector("#news .card");
    if (newsCard) {
        newsCard.innerHTML = `
            <h2>News</h2>
            <div class="empty-state">News will be added later.</div>
        `;
    }
}

/* =========================================== MAIN REFRESH =========================================== */

async function lpRefresh() {
    const slug = lpGetPathSlug();
    const stored = lpGetStoredContext();
    const season = lpGetSeasonFromSelect();

    if (!slug && !stored) {
        lpShowLeaguePrompt();
        LEAGUE_PAGE_LOADING = false;
        return;
    }

    lpShowLoading();
    await new Promise(resolve => requestAnimationFrame(resolve));

    try {
        let context = stored;

        if (!context || context.slug !== slug) {
            const found = await lpFindLeagueBySlug(slug);
            if (!found) {
                lpShowLeaguePrompt();
                LEAGUE_PAGE_LOADING = false;
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
            LEAGUE_PAGE_LOADING = false;
            return;
        }

        const leagueId = Number(context.id || context.league?.id);
        if (!Number.isFinite(leagueId)) {
            throw new Error("Invalid league id");
        }

        const [apiLeagueResult, standingsResult, teamsResult, fixturesResult, scorersResult] = await Promise.allSettled([
            lpLoadLeagueMeta(leagueId, season),
            lpLoadStandings(leagueId, season),
            lpLoadTeams(leagueId, season),
            lpLoadFixtures(leagueId, season),
            lpLoadTopScorers(leagueId, season)
        ]);

        const apiLeague = apiLeagueResult.status === "fulfilled" ? apiLeagueResult.value : null;
        const standings = standingsResult.status === "fulfilled" ? standingsResult.value : [];
        const teams = teamsResult.status === "fulfilled" ? teamsResult.value : [];
        const fixtures = fixturesResult.status === "fulfilled" ? fixturesResult.value : [];
        const scorers = scorersResult.status === "fulfilled" ? scorersResult.value : [];

        lpApplyMeta(apiLeague, context, season, teams);
        lpApplyContent({ standings, teams, fixtures, scorers });

        lpSaveContext({
            ...context,
            season
        });

    } catch (err) {
        console.error("League page load error:", err);

        lpSetText("#leagueName", "Failed to load");
        lpShowEmpty("featuredMatch", "Unable to load league data.");
        lpShowEmpty("topScorer", "Unable to load league data.");
        lpShowEmpty("matchesList", "Unable to load league data.");
        lpShowEmpty("teamsGrid", "Unable to load league data.");
        lpShowEmpty("standingsTable", "Unable to load standings.", 8);

        const newsCard = document.querySelector("#news .card");
        if (newsCard) {
            newsCard.innerHTML = `
                <h2>News</h2>
                <div class="empty-state">Unable to load news.</div>
            `;
        }
    } finally {
        LEAGUE_PAGE_LOADING = false;
    }
}

/* =========================================== EVENTS =========================================== */

function lpBindEventsOnce() {
    if (LEAGUE_PAGE_EVENTS_BOUND) return;
    LEAGUE_PAGE_EVENTS_BOUND = true;

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
            const current = lpGetStoredContext();
            const id = String(current?.id || current?.league?.id || current?.slug || "");
            if (!id) return;

            const favorites = lpSafeJSONParse(localStorage.getItem("favoriteLeagues"), []);
            const exists = favorites.some(item => String(item.id ?? item) === id);

            const next = exists
                ? favorites.filter(item => String(item.id ?? item) !== id)
                : [
                    ...favorites,
                    {
                        id: current?.id || current?.league?.id || id,
                        slug: current?.slug || "",
                        name: current?.name || current?.league?.name || "",
                        logo: current?.icon || current?.league?.logo || ""
                    }
                ];

            localStorage.setItem("favoriteLeagues", JSON.stringify(next));
            favBtn.classList.toggle("active", !exists);
        }
    });

    document.addEventListener("change", async (e) => {
        if (e.target && e.target.id === "seasonSelect") {
            const current = lpGetStoredContext();
            if (current) {
                current.season = lpGetSeasonFromSelect();
                lpSaveContext(current);
            }
            await lpRefresh();
        }
    });
}

function initLeaguePage() {
    if (!document.querySelector(".league-header")) return;

    lpBindEventsOnce();

    document.querySelector(".tab.active")?.classList.remove("active");
    document.querySelector('.tab[data-tab="overview"]')?.classList.add("active");
    document.querySelector(".page.active")?.classList.remove("active");
    document.getElementById("overview")?.classList.add("active");

    lpRefresh();
}

/* =========================================== BOOT =========================================== */

initLeaguePage();
document.addEventListener("pageLoaded", initLeaguePage);