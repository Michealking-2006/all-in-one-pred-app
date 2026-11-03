// Scoutwave control room (/mingt-t). Plain ES module, no framework, no inline
// styles or scripts (the page's CSP forbids them). Everything that came from a
// user (feedback text, emails, names) is only ever inserted as text, never as HTML.
const API = "/api/mingt";
const $app = document.getElementById("app");
const $toasts = document.getElementById("toasts");

// ---------------------------------------------------------------- helpers
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "value") node.value = value;
    else if (key === "checked") node.checked = !!value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const session = {
  get token() { return sessionStorage.getItem("mingt.token"); },
  get expires() { return Number(sessionStorage.getItem("mingt.exp")) || 0; },
  set(token, exp) { sessionStorage.setItem("mingt.token", token); sessionStorage.setItem("mingt.exp", String(exp)); },
  clear() { sessionStorage.removeItem("mingt.token"); sessionStorage.removeItem("mingt.exp"); },
};

function toast(message, bad = false) {
  const node = el("div", { class: "toast" + (bad ? " bad" : ""), text: message });
  $toasts.append(node);
  setTimeout(() => node.remove(), bad ? 6000 : 3200);
}

async function api(action, payload = {}) {
  let res;
  try {
    res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session.token ? { Authorization: "Bearer " + session.token } : {}) },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error("Can't reach the server. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data.code === "SESSION") { logout(data.error); throw new Error(data.error || "Session ended."); }
  if (!res.ok) { const err = new Error(data.error || `Request failed (${res.status}).`); err.code = data.code; err.status = res.status; throw err; }
  return data;
}

function confirmDialog({ title, message, ok = "Confirm", danger = false, body = null }) {
  return new Promise((resolve) => {
    const dialog = el("dialog", {}, [
      el("h3", { text: title }),
      el("p", { text: message }),
      body,
      el("div", { class: "row" }, [
        el("span", { class: "spacer" }),
        el("button", { class: "btn", type: "button", text: "Cancel", onClick: () => dialog.close("cancel") }),
        el("button", { class: "btn primary" + (danger ? " danger" : ""), type: "button", text: ok, onClick: () => dialog.close("ok") }),
      ]),
    ]);
    dialog.addEventListener("close", () => { const okay = dialog.returnValue === "ok"; dialog.remove(); resolve(okay ? (dialog.result ?? true) : false); });
    dialog.result = undefined;
    document.body.append(dialog);
    dialog.showModal();
  });
}

const ago = (iso) => {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.round(s / 60) + " min ago";
  if (s < 86400) return Math.round(s / 3600) + " h ago";
  if (s < 86400 * 30) return Math.round(s / 86400) + " d ago";
  return new Date(iso).toLocaleDateString();
};
const when = (iso) => (iso ? new Date(iso).toLocaleString() : "");
const clone = (v) => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------- state
let overviewCache = null;
let view = "overview";
const NAV = [
  ["Monitor", [["overview", "Overview", "home"], ["insights", "Insights", "chart"], ["usage", "Usage", "pulse"]]],
  ["Manage", [["messages", "Messages", "mail"], ["users", "Users", "users"], ["broadcast", "Broadcast", "bell"], ["config", "Remote config", "sliders"]]],
  ["Grow", [["predictions", "Predictions", "target"], ["placements", "Placements", "layout"], ["seo", "SEO", "search"]]],
  ["Protect", [["security", "Security", "shield"], ["audit", "Audit log", "list"]]],
];
const VIEWS = NAV.flatMap(([, items]) => items.map(([id, label]) => [id, label]));

// notice: why the person was signed out (shown on the sign-in screen). Passing nothing is a deliberate
// sign-out, which also ends the session on the server so the token is dead everywhere.
function logout(notice) {
  const deliberate = typeof notice !== "string";
  if (deliberate && session.token) api("logout").catch(() => {});
  session.clear();
  overviewCache = null;
  renderLogin(deliberate ? "" : notice);
}

// ---------------------------------------------------------------- login
function renderLogin(notice = "", notConfigured = false) {
  const error = el("div", { class: "error", role: "alert", hidden: true });
  const email = el("input", { id: "f-email", type: "email", autocomplete: "username", inputmode: "email" });
  const password = el("input", { id: "f-pass", type: "password", autocomplete: "current-password", required: true });
  const code = el("input", { id: "f-code", type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "7", placeholder: "123456" });
  const button = el("button", { class: "btn primary", type: "submit", text: "Sign in" });
  const show = (m) => { error.textContent = m; error.hidden = !m; };
  if (notice) show(notice);

  const form = el("form", { class: "login-card", novalidate: true }, [
    el("div", { class: "brand" }, [el("span", { class: "brand-dot" }), "Scoutwave control room"]),
    el("h1", { text: "Sign in" }),
    notConfigured
      ? el("p", { text: "Sign-in is unavailable right now." })
      : el("p", { text: "Authorised administrators only. Every action is recorded." }),
    el("div", { class: "field" }, [el("label", { for: "f-email", text: "Email (if one is configured)" }), email]),
    el("div", { class: "field" }, [el("label", { for: "f-pass", text: "Passphrase" }), password]),
    el("div", { class: "field" }, [el("label", { for: "f-code", text: "Authenticator code (6 digits, required)" }), code]),
    error,
    button,
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    show("");
    if (!password.value) { show("Enter your passphrase."); return; }
    button.disabled = true; button.textContent = "Signing in…";
    try {
      const data = await api("login", { email: email.value, password: password.value, code: code.value });
      session.set(data.token, data.expiresAt);
      session.degraded = !!data.degraded;
      location.hash = "#/overview";
      renderShell();
      if (data.degraded) toast("Signed in, but lockout and session controls are reduced until supabase/migrations/006_admin_security.sql is run.", true);
    } catch (err) {
      show(err.message);
      if (err.code === "NOT_CONFIGURED") renderLogin(err.message, true);
    } finally {
      button.disabled = false; button.textContent = "Sign in";
      password.value = ""; code.value = "";
    }
  });
  $app.replaceChildren(el("div", { class: "login-wrap" }, [form]));
  (email.value ? password : email).focus();
}

// ---------------------------------------------------------------- shell
let sessionTimer = null;

function renderShell() {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || "");
  const nav = el("nav", { class: "side", "aria-label": "Sections" }, [
    el("div", { class: "brand" }, [el("span", { class: "brand-dot" }), el("span", { class: "brand-name", text: "Control room" })]),
    el("button", { class: "search-btn", type: "button", "aria-label": "Search and jump", onClick: () => openPalette() }, [icon("search"), el("span", { class: "search-text", text: "Search or jump to…" }), el("kbd", { text: mac ? "⌘K" : "Ctrl K" })]),
    ...NAV.flatMap(([group, items]) => [
      el("div", { class: "nav-group", text: group }),
      ...items.map(([id, label, ic]) => el("button", { class: "nav-btn", type: "button", "data-view": id, "aria-current": id === view ? "page" : null, onClick: () => { location.hash = "#/" + id; } }, [icon(ic), el("span", { class: "nav-label", text: label }), id === "messages" ? el("span", { class: "count", id: "msg-count", hidden: true }) : null])),
    ]),
    el("div", { class: "side-foot" }, [
      el("span", { id: "session-left" }),
      el("button", { class: "btn small", type: "button", text: "Sign out", onClick: () => logout() }),
    ]),
  ]);
  const main = el("main", { class: "main", id: "main", tabindex: "-1" });
  $app.replaceChildren(el("div", { class: "shell" }, [nav, main]));
  clearInterval(sessionTimer);
  const tick = () => {
    const left = session.expires - Date.now();
    if (left <= 0) { logout("Your session has expired. Sign in again."); return; }
    const t = $("#session-left"); if (t) t.textContent = "Session ends in " + (left > 3600e3 ? Math.floor(left / 3600e3) + " h " + Math.floor((left % 3600e3) / 60e3) + " m" : Math.max(1, Math.round(left / 60e3)) + " m");
  };
  tick(); sessionTimer = setInterval(tick, 30000);
  route();
}

const $ = (sel) => document.querySelector(sel);

function route() {
  const wanted = (location.hash.replace(/^#\//, "") || "overview").split("?")[0];
  view = VIEWS.some(([id]) => id === wanted) ? wanted : "overview";
  document.querySelectorAll(".nav-btn").forEach((b) => b.setAttribute("aria-current", b.dataset.view === view ? "page" : "false"));
  const main = $("#main");
  if (!main) return;
  main.replaceChildren(skeleton());
  window.scrollTo(0, 0);
  const render = { overview: viewOverview, insights: viewInsights, broadcast: viewBroadcast, config: viewConfig, messages: viewMessages, users: viewUsers, usage: viewUsage, placements: viewPlacements, seo: viewSeo, security: viewSecurity, predictions: viewPredictions, audit: viewAudit }[view];
  render(main).catch((err) => main.replaceChildren(el("div", { class: "error", role: "alert", text: err.message || "Could not load this section." })));
  main.focus({ preventScroll: true });
}

function header(title, subtitle, actions) {
  return [el("div", { class: "page-head" }, [el("div", { class: "page-title" }, [el("h1", { text: title }), el("p", { class: "sub", text: subtitle })]), actions && actions.length ? el("div", { class: "page-actions" }, actions) : null])];
}
const refreshButton = () => el("button", { class: "btn small", type: "button", onClick: () => route() }, [icon("refresh"), "Refresh"]);

function updateInboxCount(n) {
  const badge = $("#msg-count");
  if (!badge) return;
  badge.hidden = !n;
  badge.textContent = String(n || "");
}

// ---------------------------------------------------------------- overview
async function viewOverview(main) {
  const [data, ins] = await Promise.all([api("overview"), api("insights").catch(() => null)]);
  overviewCache = data;
  updateInboxCount(data.inbox?.new);
  const f = data.football || {};
  const pct = f.ok && f.limit ? Math.min(100, Math.round((f.used / f.limit) * 100)) : null;
  const cfg = data.config || {};
  const bar = el("div", { class: "bar" + (pct >= 85 ? " hot" : ""), role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": pct ?? 0, "aria-label": "Football API requests used today" }, [el("span")]);
  bar.firstChild.style.width = (pct ?? 0) + "%";
  const u = ins?.users, m = ins?.messages, pr = ins?.predictions;

  // What needs a person's attention right now.
  const todo = [];
  for (const h of data.health || []) if (!h.ok) todo.push({ tone: "bad", title: h.label, detail: h.detail });
  if (data.inbox?.new > 0) todo.push({ tone: "warn", title: `${data.inbox.new} new message${data.inbox.new === 1 ? "" : "s"} waiting`, detail: "Feedback and issue reports from the app.", to: "messages" });
  if (cfg.maintenance?.on) todo.push({ tone: "bad", title: "Maintenance mode is on", detail: "Users see the maintenance screen.", to: "config" });
  if (pct != null && pct >= 85) todo.push({ tone: "warn", title: `Football API quota is ${pct}% used`, detail: "Prediction runs keep working but cover fewer matches.", to: "usage" });
  if (ins?.push?.failing > 0) todo.push({ tone: "warn", title: `${ins.push.failing} device${ins.push.failing === 1 ? "" : "s"} failing to receive alerts`, detail: "They are removed automatically after repeated failures.", to: "insights" });
  const attention = el("div", { class: "card" }, [
    el("div", { class: "card-head" }, [el("h2", { text: "Needs attention" }), el("span", { class: "chip " + (todo.length ? "warn" : "ok"), text: todo.length ? String(todo.length) : "All clear" })]),
    todo.length
      ? el("div", { class: "todo" }, todo.map((t) => el(t.to ? "button" : "div", { class: "todo-row", ...(t.to ? { type: "button", onClick: () => { location.hash = "#/" + t.to; } } : {}) }, [el("span", { class: "dot " + (t.tone === "bad" ? "" : "warn"), "aria-hidden": "true" }), el("div", {}, [el("strong", { text: t.title }), el("small", { text: t.detail })]), t.to ? icon("chevron") : null])))
      : el("p", { class: "sub", text: "Every check passes and nothing is waiting for you." }),
  ]);

  const tools = el("div", { class: "card" }, [
    el("h2", { text: "Quick tools" }),
    el("div", { class: "tools" }, [
      tool("bell", "Send a broadcast", "Notify every device that has alerts on.", () => { location.hash = "#/broadcast"; }),
      tool("mail", "Mark all messages read", "Clears the new-message badge. Nothing is deleted.", async () => {
        try { const r = await api("messages_mark_read"); toast(`${r.updated} message${r.updated === 1 ? "" : "s"} marked read`); route(); } catch (e) { toast(e.message, true); }
      }),
      tool("refresh", "Clear old saved football data", "Drops saved tables and results older than 6 hours.", async () => {
        if (!(await confirmDialog({ title: "Clear old saved football data?", message: "The next prediction run fetches fresh copies. It may use more football API requests.", ok: "Clear" }))) return;
        try { const r = await api("cache_purge", { scope: "old" }); toast(`${r.removed} saved item${r.removed === 1 ? "" : "s"} cleared`); } catch (e) { toast(e.message, true); }
      }),
      tool("target", "Open predictions", "Run the prediction job now and check accuracy.", () => { location.hash = "#/predictions"; }),
    ]),
  ]);

  main.replaceChildren(
    ...header("Overview", `Health, audience and what needs you · v${data.version} · ${data.deploy.env}${data.deploy.commit ? " · " + data.deploy.commit : ""}`, [refreshButton()]),
    el("div", { class: "stack" }, [
      el("div", { class: "grid" }, [
        kpi("Registered users", data.users == null ? "–" : String(data.users), u ? `+${u.new7} this week · ${u.active7} active in 7 days` : "", u?.signups.slice(-14).map((d) => d.signups)),
        kpi("New messages", data.inbox?.new == null ? "–" : String(data.inbox.new), data.inbox?.total != null ? `${data.inbox.total} in total` : "", m?.perDay.slice(-14).map((d) => d.messages)),
        el("div", { class: "card kpi" }, [el("div", { class: "kpi-top" }, [el("span", { class: "lbl", text: "Football API today" })]), el("div", { class: "num", text: pct == null ? "–" : pct + "%" }), el("div", { class: "kpi-sub", text: f.ok ? `${f.used} of ${f.limit} requests` : "Quota unavailable" }), pct == null ? null : bar]),
        kpi("Predictions, next 7 days", pr ? String(pr.upcomingTotal) : "–", pr ? "matches with a prediction" : "", pr?.upcoming.map((d) => d.predictions)),
      ]),
      attention,
      el("div", { class: "grid wide" }, [
        el("div", { class: "card" }, [el("h2", { text: "Health checks" }), el("div", { class: "health" }, data.health.map((h) =>
          el("div", { class: "health-row" }, [el("span", { class: "dot" + (h.ok ? " ok" : ""), role: "img", "aria-label": h.ok ? "OK" : "Needs attention" }), el("div", {}, [el("strong", { text: h.label }), el("small", { text: h.detail })])])))]),
        el("div", { class: "card" }, [el("h2", { text: "Live right now" }), el("div", { class: "health" }, [
          liveRow("Maintenance mode", cfg.maintenance?.on ? "bad" : "ok", cfg.maintenance?.on ? "ON: users see the maintenance screen" : "Off"),
          liveRow("Announcement banner", cfg.announcement?.on ? "warn" : "ok", cfg.announcement?.on ? `Showing: “${cfg.announcement.text}”` : "None"),
          liveRow("Minimum app version", "ok", cfg.minVersion || "0.0.0"),
          liveRow("Predictions", cfg.flags?.predictions ? "ok" : "warn", cfg.flags?.predictions ? "Enabled for everyone" : "Off (coming soon)"),
          liveRow("Advanced themes", cfg.flags?.advancedThemes === false ? "bad" : "ok", cfg.flags?.advancedThemes === false ? "Disabled (kill switch)" : "Enabled"),
        ]), el("div", { class: "row" }, [el("button", { class: "btn small", type: "button", text: "Edit remote config", onClick: () => { location.hash = "#/config"; } })])]),
      ]),
      tools,
    ])
  );
}

function tool(ic, title, detail, run) {
  return el("button", { class: "tool", type: "button", onClick: run }, [el("span", { class: "tool-ico" }, [icon(ic)]), el("span", { class: "tool-text" }, [el("strong", { text: title }), el("small", { text: detail })])]);
}

function liveRow(label, tone, detail) {
  return el("div", { class: "health-row" }, [el("span", { class: "dot" + (tone === "ok" ? " ok" : tone === "warn" ? " warn" : ""), "aria-hidden": "true" }), el("div", {}, [el("strong", { text: label }), el("small", { text: detail })])]);
}

// ---------------------------------------------------------------- config
const FLAG_INFO = {
  predictions: ["Predictions", "Show Scoutwave's own prediction model on match pages and the VIP tab."],
  advancedThemes: ["Advanced themes", "Kill switch for Fire, Water, Ice and Bubbles. Turn off if they ever misbehave."],
  serverEntitlements: ["Account Premium and coins", "Signed-in users get Premium, coins and unlocks from their account (granted here, spent through the server). Guests keep the local demo. Needs migration 002."],
};

const PLACEMENT_SLOTS = [
  ["news_list", "In the news list", "After the fourth story in the list."],
  ["news_top", "Top of a story", "Under the headline, above the summary."],
  ["news_inline", "Middle of a story", "After the summary, above the full-story button."],
  ["news_bottom", "End of a story", "Under the full-story button."],
];

async function viewConfig(main) {
  const { config, flagsKnown } = await api("config_get");
  const loaded = clone(config);
  let draft = clone(config);
  const a = () => draft.announcement;

  const summary = () => {
    const out = [];
    for (const k of flagsKnown) if (loaded.flags[k] !== draft.flags[k]) out.push(`${(FLAG_INFO[k] || [k])[0]}: ${draft.flags[k] ? "on" : "off"}`);
    if (JSON.stringify(loaded.maintenance) !== JSON.stringify(draft.maintenance)) out.push(`Maintenance mode: ${draft.maintenance.on ? "ON" : "off"}`);
    if (JSON.stringify(loaded.announcement) !== JSON.stringify(draft.announcement)) out.push(`Announcement: ${draft.announcement.on ? "showing" : "off"}`);
    if (JSON.stringify(loaded.placements) !== JSON.stringify(draft.placements)) out.push("News placements changed");
    if (loaded.minVersion !== draft.minVersion) out.push(`Minimum version: ${draft.minVersion}`);
    if (JSON.stringify(loaded.fxPrices) !== JSON.stringify(draft.fxPrices)) out.push("Theme prices changed");
    if (loaded.tipCost !== draft.tipCost) out.push(`Tip unlock cost: ${draft.tipCost} coins`);
    return out;
  };

  const save = el("button", { class: "btn primary", type: "button", text: "Save changes" });
  const revert = el("button", { class: "btn", type: "button", text: "Discard changes" });
  const status = el("span", { class: "sub" });
  const refreshBar = () => { const n = summary().length; save.disabled = !n; revert.disabled = !n; status.textContent = n ? `${n} unsaved change${n > 1 ? "s" : ""}` : "Everything is saved"; };

  const toggle = (get, set, label) => {
    const t = el("button", { class: "toggle", type: "button", role: "switch", "aria-checked": String(!!get()), "aria-label": label });
    t.addEventListener("click", () => { set(!get()); t.setAttribute("aria-checked", String(!!get())); refreshBar(); paintPreview(); });
    return t;
  };
  const input = (props, get, set) => {
    const i = el("input", { ...props, value: get() ?? "" });
    i.addEventListener("input", () => { set(i.value); refreshBar(); paintPreview(); });
    return i;
  };

  const preview = el("div", { class: "preview info" });
  const paintPreview = () => { preview.className = "preview " + a().level; preview.textContent = a().text || "Your announcement text appears here."; };

  const levelSel = el("select", { id: "an-level" }, ["info", "warn", "success"].map((l) => el("option", { value: l, text: l === "info" ? "Information" : l === "warn" ? "Warning" : "Good news" })));
  levelSel.value = a().level; levelSel.addEventListener("change", () => { a().level = levelSel.value; refreshBar(); paintPreview(); });
  const expiry = el("input", { id: "an-exp", type: "datetime-local" });
  if (a().expiresAt) { const d = new Date(a().expiresAt); expiry.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  expiry.addEventListener("input", () => { a().expiresAt = expiry.value ? new Date(expiry.value).toISOString() : null; refreshBar(); });

  main.replaceChildren(
    ...header("Remote config", "Changes reach every device within about a minute. No deploy needed."),
    el("div", { class: "stack" }, [
      el("div", { class: "card" }, [el("h2", { text: "Feature flags" }), ...flagsKnown.map((k) => el("div", { class: "switch" }, [el("div", {}, [el("div", { class: "t", text: (FLAG_INFO[k] || [k])[0] }), el("div", { class: "d", text: (FLAG_INFO[k] || ["", ""])[1] })]), toggle(() => draft.flags[k], (v) => { draft.flags[k] = v; }, (FLAG_INFO[k] || [k])[0])]))]),
      el("div", { class: "card" }, [
        el("h2", { text: "Maintenance mode" }),
        el("div", { class: "switch" }, [el("div", {}, [el("div", { class: "t", text: "Show the maintenance screen to everyone" }), el("div", { class: "d", text: "The app is replaced by a friendly message until you turn this off. This dashboard keeps working." })]), toggle(() => draft.maintenance.on, (v) => { draft.maintenance.on = v; }, "Maintenance mode")]),
        el("div", { class: "field" }, [el("label", { for: "mt-msg", text: "Message (optional)" }), input({ id: "mt-msg", type: "text", maxlength: "300", placeholder: "We're upgrading live scores and will be back shortly." }, () => draft.maintenance.message, (v) => { draft.maintenance.message = v; })]),
      ]),
      el("div", { class: "card" }, [
        el("h2", { text: "Announcement banner" }),
        el("div", { class: "switch" }, [el("div", {}, [el("div", { class: "t", text: "Show a banner at the top of the app" }), el("div", { class: "d", text: "People can dismiss it. Editing the text shows it again to everyone." })]), toggle(() => a().on, (v) => { a().on = v; }, "Announcement banner")]),
        el("div", { class: "field" }, [el("label", { for: "an-text", text: "Text" }), input({ id: "an-text", type: "text", maxlength: "240", placeholder: "Predictions are live. Try them on any match page." }, () => a().text, (v) => { a().text = v; })]),
        el("div", { class: "two" }, [
          el("div", { class: "field" }, [el("label", { for: "an-level", text: "Style" }), levelSel]),
          el("div", { class: "field" }, [el("label", { for: "an-link", text: "Link (optional)" }), input({ id: "an-link", type: "text", maxlength: "300", placeholder: "https://… or /news" }, () => a().link, (v) => { a().link = v; })]),
        ]),
        el("div", { class: "field" }, [el("label", { for: "an-exp", text: "Hide automatically after (optional)" }), expiry]),
        el("div", { class: "field" }, [el("label", { text: "Preview" }), preview]),
      ]),
      el("div", { class: "card" }, [
        el("h2", { text: "News placements" }),
        el("p", { class: "sub", text: "Spaces for an ad or a promotion in the news section. Each is labelled so it can't be mistaken for a story, and stays hidden until it has a headline and a link and is switched on." }),
        ...PLACEMENT_SLOTS.map(([slot, title, hint]) => {
          const p = () => draft.placements[slot];
          const labelSel = el("select", { id: "pl-label-" + slot }, ["Sponsored", "Ad", "Partner", "Promoted"].map((l) => el("option", { value: l, text: l })));
          labelSel.value = p().label; labelSel.addEventListener("change", () => { p().label = labelSel.value; refreshBar(); });
          return el("div", { class: "placement-editor" }, [
            el("div", { class: "switch" }, [el("div", {}, [el("div", { class: "t", text: title }), el("div", { class: "d", text: hint })]), toggle(() => p().on, (v) => { p().on = v; }, title)]),
            el("div", { class: "two" }, [
              el("div", { class: "field" }, [el("label", { for: "pl-title-" + slot, text: "Headline" }), input({ id: "pl-title-" + slot, type: "text", maxlength: "90", placeholder: "Short and clear" }, () => p().title, (v) => { p().title = v; })]),
              el("div", { class: "field" }, [el("label", { for: "pl-label-" + slot, text: "Label shown" }), labelSel]),
            ]),
            el("div", { class: "field" }, [el("label", { for: "pl-text-" + slot, text: "Text (optional)" }), input({ id: "pl-text-" + slot, type: "text", maxlength: "200" }, () => p().text, (v) => { p().text = v; })]),
            el("div", { class: "two" }, [
              el("div", { class: "field" }, [el("label", { for: "pl-link-" + slot, text: "Link" }), input({ id: "pl-link-" + slot, type: "text", maxlength: "500", placeholder: "https://… or /premium" }, () => p().link, (v) => { p().link = v; })]),
              el("div", { class: "field" }, [el("label", { for: "pl-cta-" + slot, text: "Button text" }), input({ id: "pl-cta-" + slot, type: "text", maxlength: "24", placeholder: "Learn more" }, () => p().cta, (v) => { p().cta = v; })]),
            ]),
            el("div", { class: "two" }, [
              el("div", { class: "field" }, [el("label", { for: "pl-start-" + slot, text: "Starts (optional)" }), input({ id: "pl-start-" + slot, type: "date" }, () => p().startsAt || "", (v) => { p().startsAt = v; })]),
              el("div", { class: "field" }, [el("label", { for: "pl-end-" + slot, text: "Ends (optional, last day shown)" }), input({ id: "pl-end-" + slot, type: "date" }, () => p().endsAt || "", (v) => { p().endsAt = v; })]),
            ]),
            el("div", { class: "field" }, [el("label", { for: "pl-img-" + slot, text: "Image address (optional, https)" }), input({ id: "pl-img-" + slot, type: "text", maxlength: "500", placeholder: "https://…/banner.jpg" }, () => p().image, (v) => { p().image = v; })]),
          ]);
        }),
      ]),
      el("div", { class: "card" }, [
        el("h2", { text: "Minimum app version" }),
        el("p", { class: "sub", text: "Devices older than this are asked to update before they can continue. Leave at 0.0.0 for no limit." }),
        el("div", { class: "field" }, [el("label", { for: "min-v", text: "Version" }), input({ id: "min-v", type: "text", maxlength: "20", placeholder: "0.0.0" }, () => draft.minVersion, (v) => { draft.minVersion = v; })]),
      ]),
      el("div", { class: "card" }, [
        el("h2", { text: "Coin prices" }),
        el("div", { class: "field" }, [el("label", { for: "tip-cost", text: "Unlock one tip (coins)" }), input({ id: "tip-cost", type: "number", min: "0", max: "500", step: "1" }, () => draft.tipCost, (v) => { draft.tipCost = v === "" ? "" : Number(v); })]),
        el("h2", { text: "Theme prices (coins)" }),
        el("div", { class: "grid" }, ["fire", "ice", "bubbles"].map((k) => el("div", { class: "field" }, [el("label", { for: "px-" + k, text: k[0].toUpperCase() + k.slice(1) }), input({ id: "px-" + k, type: "number", min: "0", max: "5000", step: "1" }, () => draft.fxPrices[k], (v) => { draft.fxPrices[k] = v === "" ? "" : Number(v); })]))),
        el("p", { class: "sub", text: "Water is part of Premium and cannot be bought with coins." }),
      ]),
      el("div", { class: "savebar" }, [save, revert, status]),
    ])
  );
  paintPreview(); refreshBar();

  revert.addEventListener("click", () => viewConfig(main));
  save.addEventListener("click", async () => {
    const lines = summary();
    const ok = await confirmDialog({ title: "Publish these changes?", message: lines.join("\n") + "\n\nThey go live for every user.", ok: "Publish", danger: draft.maintenance.on && !loaded.maintenance.on });
    if (!ok) return;
    save.disabled = true; save.textContent = "Saving…";
    try {
      await api("config_set", { config: draft });
      toast("Published");
      await viewConfig(main);
    } catch (err) {
      toast(err.message, true);
      save.textContent = "Save changes"; refreshBar();
    }
  });
}

// ---------------------------------------------------------------- messages
async function viewMessages(main) {
  const st = { status: "all", q: "", items: [], total: 0, offset: 0 };
  const list = el("div", { class: "stack" });
  const more = el("div", { class: "row" });
  const search = el("input", { type: "search", placeholder: "Search messages, names, emails…", "aria-label": "Search messages" });
  const pills = ["all", "new", "read", "resolved"].map((s) => el("button", { class: "pill", type: "button", "aria-pressed": String(s === "all"), text: s[0].toUpperCase() + s.slice(1), onClick: () => { st.status = s; pills.forEach((p, i) => p.setAttribute("aria-pressed", String(["all", "new", "read", "resolved"][i] === s))); load(true); } }));
  let timer;
  search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { st.q = search.value; load(true); }, 350); });

  async function load(reset) {
    if (reset) { st.items = []; st.offset = 0; list.replaceChildren(el("p", { class: "boot", text: "Loading…" })); }
    try {
      const data = await api("messages_list", { status: st.status === "all" ? undefined : st.status, q: st.q, offset: st.offset });
      st.items = st.items.concat(data.items); st.total = data.total ?? st.items.length; st.offset = st.items.length;
      draw();
    } catch (err) { list.replaceChildren(el("div", { class: "error", role: "alert", text: err.message })); }
  }

  function draw() {
    list.replaceChildren(...(st.items.length ? st.items.map(card) : [el("div", { class: "empty card", text: "No messages here." })]));
    more.replaceChildren(...(st.items.length < st.total ? [el("button", { class: "btn", type: "button", text: `Load more (${st.total - st.items.length} left)`, onClick: () => load(false) })] : []));
  }

  function card(m) {
    const note = el("textarea", { "aria-label": "Private note", placeholder: "Private note (only you see this)", maxlength: "500" }); note.value = m.note || "";
    const setStatus = async (status) => { try { await api("message_update", { id: m.id, status }); m.status = status; toast("Marked " + status); draw(); } catch (e) { toast(e.message, true); } };
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.email || "") ? m.email : "";
    return el("article", { class: "card msg" }, [
      el("div", { class: "msg-head" }, [
        el("span", { class: "chip " + (m.status === "new" ? "warn" : m.status === "resolved" ? "ok" : "") , text: m.status }),
        el("strong", { text: [m.kind, m.category].filter(Boolean).join(" · ") }),
        m.rating ? el("span", { class: "stars", "aria-label": m.rating + " stars", text: "★".repeat(m.rating) + "☆".repeat(5 - m.rating) }) : null,
        el("span", { class: "spacer" }),
        el("span", { class: "msg-meta", title: when(m.created_at), text: ago(m.created_at) }),
      ]),
      el("div", { class: "msg-body", text: m.message }),
      el("div", { class: "msg-meta", text: [m.name, m.email, m.app_version && "v" + m.app_version, m.page].filter(Boolean).join(" · ") }),
      el("div", { class: "msg-meta", text: m.user_agent || "" }),
      note,
      el("div", { class: "row" }, [
        m.status !== "read" ? el("button", { class: "btn small", type: "button", text: "Mark read", onClick: () => setStatus("read") }) : null,
        m.status !== "resolved" ? el("button", { class: "btn small", type: "button", text: "Resolve", onClick: () => setStatus("resolved") }) : null,
        m.status !== "new" ? el("button", { class: "btn small", type: "button", text: "Reopen", onClick: () => setStatus("new") }) : null,
        email ? el("a", { class: "btn small", href: "mailto:" + email + "?subject=" + encodeURIComponent("Re: your Scoutwave " + m.kind), text: "Reply by email" }) : null,
        el("button", { class: "btn small", type: "button", text: "Save note", onClick: async () => { try { await api("message_update", { id: m.id, note: note.value }); toast("Note saved"); } catch (e) { toast(e.message, true); } } }),
        el("span", { class: "spacer" }),
        el("button", { class: "btn small danger", type: "button", text: "Delete", onClick: async () => { if (!(await confirmDialog({ title: "Delete this message?", message: "This cannot be undone.", ok: "Delete", danger: true }))) return; try { await api("message_delete", { id: m.id }); st.items = st.items.filter((x) => x.id !== m.id); st.total = Math.max(0, st.total - 1); toast("Deleted"); draw(); } catch (e) { toast(e.message, true); } } }),
      ]),
    ]);
  }

  main.replaceChildren(...header("Messages", "Feedback, issue reports and contact messages from the app."), el("div", { class: "filters" }, [...pills, search, el("button", { class: "btn small", type: "button", text: "Mark all new as read", onClick: async () => {
    if (!(await confirmDialog({ title: "Mark every new message as read?", message: "Nothing is deleted.", ok: "Mark all read" }))) return;
    try { const r = await api("messages_mark_read"); toast(`${r.updated} marked read`); updateInboxCount(0); load(true); } catch (e) { toast(e.message, true); }
  } })]), list, more);
  await load(true);
}

// ---------------------------------------------------------------- users
async function viewUsers(main) {
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const st = { page: 1, total: null, users: [], q: params.get("q") || "", filter: "all", capped: false };
  const body = el("div", { class: "card tablewrap" });
  const pager = el("div", { class: "row" });
  const filter = el("input", { type: "search", placeholder: "Search by email or id…", "aria-label": "Search users", value: st.q });
  let typing;
  filter.addEventListener("input", () => { clearTimeout(typing); typing = setTimeout(() => { st.q = filter.value; st.page = 1; load(); }, 300); });
  const FILTERS = [["all", "All"], ["premium", "Premium"], ["banned", "Banned"], ["inactive", "Inactive 30d+"], ["unconfirmed", "Unconfirmed"]];
  const pills = FILTERS.map(([id, label]) => el("button", { class: "pill", type: "button", "aria-pressed": String(id === st.filter), text: label, onClick: () => { st.filter = id; st.page = 1; pills.forEach((p, i) => p.setAttribute("aria-pressed", String(FILTERS[i][0] === id))); load(); } }));
  const exportBtn = el("button", { class: "btn small", type: "button" }, [icon("download"), "Export CSV"]);
  exportBtn.addEventListener("click", async () => {
    exportBtn.disabled = true;
    try {
      const out = await api("users_export", { q: st.q, filter: st.filter });
      const rows = [["Email", "Signed up", "Last sign-in", "Sign-in methods", "Premium", "Premium until", "Coins", "Confirmed", "Banned until"]];
      for (const x of out.users) rows.push([x.email, x.createdAt, x.lastSignInAt || "", x.providers.join(" "), x.premium ? "yes" : "no", x.premiumUntil || "", x.coins ?? "", x.confirmed ? "yes" : "no", x.bannedUntil || ""]);
      downloadCsv(`scoutwave-users-${new Date().toISOString().slice(0, 10)}.csv`, rows);
      toast(`${out.users.length} user${out.users.length === 1 ? "" : "s"} exported`);
    } catch (e) { toast(e.message, true); } finally { exportBtn.disabled = false; }
  });

  async function load() {
    body.replaceChildren(el("p", { class: "boot", text: "Loading…" }));
    try {
      const data = await api("users_search", { q: st.q, filter: st.filter, page: st.page });
      st.users = data.users; st.total = data.total; st.capped = data.capped; draw();
    } catch (e) { body.replaceChildren(el("div", { class: "error", role: "alert", text: e.message })); }
  }
  function draw() {
    const rows = st.users;
    const banned = (u) => u.bannedUntil && new Date(u.bannedUntil).getTime() > Date.now();
    body.replaceChildren(rows.length ? el("table", {}, [
      el("thead", {}, [el("tr", {}, ["Email", "Sign-in", "Joined", "Last seen", "Premium", "Coins", "Status", ""].map((h) => el("th", { text: h })))]),
      el("tbody", {}, rows.map((u) => el("tr", {}, [
        el("td", { class: "mono", text: u.email || "(no email)" }),
        el("td", { text: u.providers.join(", ") || "email" }),
        el("td", { title: when(u.createdAt), text: ago(u.createdAt) }),
        el("td", { title: when(u.lastSignInAt), text: ago(u.lastSignInAt) }),
        el("td", {}, [u.premium ? el("span", { class: "chip ok", title: u.premiumUntil ? "Until " + when(u.premiumUntil) : "No end date", text: u.premiumUntil ? "Until " + new Date(u.premiumUntil).toLocaleDateString() : "Premium" }) : el("span", { class: "chip", text: "No" })]),
        el("td", { class: "mono", text: u.coins == null ? "–" : String(u.coins) }),
        el("td", {}, [banned(u) ? el("span", { class: "chip bad", text: "Banned" }) : el("span", { class: "chip " + (u.confirmed ? "ok" : "warn"), text: u.confirmed ? "Active" : "Unconfirmed" })]),
        el("td", {}, [el("div", { class: "row" }, [
          el("button", { class: "btn small", type: "button", text: "Premium & coins…", onClick: () => manage(u) }),
          banned(u)
            ? el("button", { class: "btn small", type: "button", text: "Unban", onClick: () => act(u, "user_unban") })
            : el("button", { class: "btn small danger", type: "button", text: "Ban…", onClick: () => ban(u) }),
        ])]),
      ]))),
    ]) : el("div", { class: "empty", text: "No users match." }));
    const pages = Math.max(1, Math.ceil((st.total || 0) / 50));
    pager.replaceChildren(
      el("button", { class: "btn small", type: "button", text: "Previous", disabled: st.page <= 1, onClick: () => { st.page--; load(); } }),
      el("span", { class: "sub", text: `Page ${st.page} of ${pages} · ${st.total ?? 0} user${st.total === 1 ? "" : "s"}${st.capped ? " (first 5,000 accounts only)" : ""}` }),
      el("button", { class: "btn small", type: "button", text: "Next", disabled: st.page >= pages, onClick: () => { st.page++; load(); } })
    );
  }
  async function act(u, action, extra = {}) {
    try { await api(action, { id: u.id, ...extra }); toast(action === "user_unban" ? "Unbanned" : "Banned"); await load(); } catch (e) { toast(e.message, true); }
  }
  // Grant or revoke Premium, add or remove coins. A reason is required: it goes in the audit log.
  async function manage(u) {
    const premium = el("select", { id: "mg-prem", "aria-label": "Premium" }, [["keep", "Leave as it is"], ["7", "Grant for 7 days"], ["30", "Grant for 30 days"], ["90", "Grant for 90 days"], ["365", "Grant for a year"], ["perm", "Grant permanently"], ["off", "Revoke Premium"]].map(([v, l]) => el("option", { value: v, text: l })));
    const coins = el("input", { id: "mg-coins", type: "number", step: "1", placeholder: "e.g. 50 or -10", "aria-label": "Coin change" });
    const reason = el("input", { id: "mg-why", type: "text", maxlength: "200", placeholder: "Reason (kept in the audit log)", "aria-label": "Reason" });
    const body = el("div", { class: "stack" }, [
      el("p", { class: "msg-meta", text: `Now: ${u.premium ? "Premium" + (u.premiumUntil ? " until " + new Date(u.premiumUntil).toLocaleDateString() : "") : "no Premium"} · ${u.coins == null ? "no coin balance yet" : u.coins + " coins"}` }),
      el("div", { class: "field" }, [el("label", { for: "mg-prem", text: "Premium" }), premium]),
      el("div", { class: "field" }, [el("label", { for: "mg-coins", text: "Add or remove coins" }), coins]),
      el("div", { class: "field" }, [el("label", { for: "mg-why", text: "Reason" }), reason]),
    ]);
    const ok = await confirmDialog({ title: "Premium & coins for " + (u.email || "this user"), message: "Applies to their account straight away.", ok: "Apply", body });
    if (!ok) return;
    const payload = { id: u.id, reason: reason.value, coinsDelta: coins.value === "" ? 0 : Number(coins.value) };
    if (premium.value === "off") payload.vip = false;
    else if (premium.value === "perm") { payload.vip = true; payload.permanent = true; }
    else if (premium.value !== "keep") { payload.vip = true; payload.days = Number(premium.value); }
    try { await api("entitlement_set", payload); toast("Updated"); await load(); } catch (e) { toast(e.message, true); }
  }
  async function ban(u) {
    const sel = el("select", { "aria-label": "Ban length" }, [["24", "24 hours"], ["168", "7 days"], ["720", "30 days"], ["perm", "Permanently"]].map(([v, l]) => el("option", { value: v, text: l })));
    const dialogBody = el("div", { class: "field" }, [sel]);
    const ok = await confirmDialog({ title: "Ban " + (u.email || "this user") + "?", message: "They will be signed out and unable to sign in until the ban ends.", ok: "Ban", danger: true, body: dialogBody });
    if (ok) act(u, "user_ban", sel.value === "perm" ? { permanent: true } : { hours: Number(sel.value) });
  }

  main.replaceChildren(...header("Users", "Find anyone who has created a Scoutwave account, grant Premium or coins, or export a list.", [exportBtn]), el("div", { class: "filters" }, [filter]), el("div", { class: "filters" }, pills), body, pager);
  await load();
}

// ---------------------------------------------------------------- audit
async function viewAudit(main) {
  const { items } = await api("audit_list", { limit: 300 });
  const st = { q: "", kind: "all" };
  const KINDS = [["all", "All"], ["login", "Sign-ins"], ["change", "Changes"], ["alert", "Warnings"]];
  const isLogin = (a) => a.action.startsWith("login") || a.action.startsWith("session");
  const isAlert = (a) => /failed|locked|replayed|rejected|ip_changed/.test(a.action);
  const keep = (a) => {
    const kind = st.kind === "all" || (st.kind === "login" && isLogin(a)) || (st.kind === "change" && !isLogin(a)) || (st.kind === "alert" && isAlert(a));
    return kind && (!st.q || `${a.action} ${JSON.stringify(a.detail || {})} ${a.ip || ""}`.toLowerCase().includes(st.q));
  };
  const body = el("div", { class: "card tablewrap" });
  const count = el("span", { class: "sub" });
  function draw() {
    const rows = items.filter(keep);
    count.textContent = `${rows.length} of ${items.length} shown`;
    body.replaceChildren(rows.length ? el("table", {}, [
      el("thead", {}, [el("tr", {}, ["When", "Action", "Details", "IP"].map((h) => el("th", { text: h })))]),
      el("tbody", {}, rows.map((a) => el("tr", {}, [
        el("td", { title: when(a.at), text: ago(a.at) }),
        el("td", {}, [el("code", { text: a.action })]),
        el("td", { class: "audit-detail", text: a.detail && Object.keys(a.detail).length ? JSON.stringify(a.detail).slice(0, 300) : "" }),
        el("td", { class: "mono", text: a.ip || "" }),
      ]))),
    ]) : el("div", { class: "empty", text: items.length ? "Nothing matches." : "Nothing recorded yet." }));
  }
  const pills = KINDS.map(([id, label]) => el("button", { class: "pill", type: "button", "aria-pressed": String(id === st.kind), text: label, onClick: () => { st.kind = id; pills.forEach((p, i) => p.setAttribute("aria-pressed", String(KINDS[i][0] === id))); draw(); } }));
  const search = el("input", { type: "search", placeholder: "Search actions, details, IP addresses…", "aria-label": "Search the audit log" });
  search.addEventListener("input", () => { st.q = search.value.toLowerCase(); draw(); });
  const exportBtn = el("button", { class: "btn small", type: "button", onClick: () => {
    downloadCsv(`scoutwave-audit-${new Date().toISOString().slice(0, 10)}.csv`, [["When", "Action", "Details", "IP"], ...items.filter(keep).map((a) => [a.at, a.action, a.detail && Object.keys(a.detail).length ? JSON.stringify(a.detail) : "", a.ip || ""])]);
  } }, [icon("download"), "Export CSV"]);
  main.replaceChildren(...header("Audit log", "Every sign-in and change made from this dashboard.", [exportBtn]), el("div", { class: "filters" }, [...pills, search]), body, count);
  draw();
}

// ---------------------------------------------------------------- security
const EVENT_LABELS = {
  login: "Signed in", "login.failed": "Failed sign-in attempt", "login.locked": "Sign-in locked after repeated failures",
  "login.replayed_code": "Authenticator code reused (blocked)", "session.rejected": "Session ended: different browser or network",
  "session.ip_changed": "Session continued from a new IP address", "session.revoked": "Session ended from this page", "sessions.revoke_all": "Signed out everywhere",
};
async function viewSecurity(main) {
  const r = await api("security_overview");
  const item = (ok, title, detail) => el("div", { class: "check " + (ok ? "ok" : "bad") }, [el("strong", { text: (ok ? "On: " : "Off: ") + title }), el("span", { class: "sub", text: detail })]);

  const revoke = async (id, current) => {
    try { await api("session_revoke", { id }); if (current) { logout("You signed out this session."); return; } toast("Session ended."); route(); } catch (err) { toast(err.message, true); }
  };
  const everywhere = el("button", { class: "btn small", type: "button", text: "Sign out everywhere" });
  everywhere.addEventListener("click", async () => {
    if (!confirm("End every admin session, including this one?")) return;
    everywhere.disabled = true;
    try { await api("sessions_revoke_all"); logout("All sessions were ended. Sign in again."); } catch (err) { toast(err.message, true); everywhere.disabled = false; }
  });

  main.replaceChildren(
    ...header("Security", "How the admin sign-in is protected, who is signed in, and what has been tried."),
    el("div", { class: "stack" }, [
      r.protectionsActive && !r.degradedSession ? null : el("div", { class: "card notice bad" }, [el("strong", { text: "Reduced protection" }), el("p", { class: "sub", text: "A one-time update is needed for full sign-in protection. Until then lockouts are short-lived and sessions can't be listed or revoked." })]),
      el("div", { class: "card" }, [
        el("h2", { text: "Three layers on sign-in" }),
        item(r.twoFactor, "Required two-factor, every code works once", "A code that was seen can't be replayed. Without ADMIN_TOTP_SECRET nobody can sign in."),
        item(r.protectionsActive, "Lockout that survives restarts", "5 failures from one address lock it for 15 minutes, doubling each time (up to a day). 20 failures from anywhere in an hour lock sign-in for 15 minutes."),
        item(r.protectionsActive, `Server-side sessions, ${r.idleMinutes}-minute idle limit`, "Tied to the browser that signed in" + (r.bindIp ? " and its network (ADMIN_BIND_IP)" : "; set ADMIN_BIND_IP=1 to tie them to the network as well") + ". Revocable below."),
      ]),
      el("div", { class: "card" }, [
        el("h2", { text: "Page protection (Content-Security-Policy)" }),
        el("p", { class: "sub", text: "The app only runs its own scripts, so injected code can't run, and it can only talk to the services it needs. Browsers report anything it blocks; a healthy site shows none." }),
        Object.keys(r.csp || {}).length
          ? el("p", { class: "sub", text: "Blocked in the last 14 days: " + Object.entries(r.csp).map(([k, n]) => `${k} ${n}`).join(", ") + ". A sudden jump right after a deploy usually means something legitimate is being blocked; the header is in vercel.json." })
          : el("p", { class: "sub", text: "Nothing blocked in the last 14 days." }),
      ]),
      el("div", { class: "card tablewrap" }, [
        el("h2", { text: "Active sessions" }),
        r.sessions.length ? el("table", {}, [
          el("thead", {}, [el("tr", {}, ["Device", "Address", "Signed in", "Last active", ""].map((x) => el("th", { text: x })))]),
          el("tbody", {}, r.sessions.map((x) => el("tr", {}, [
            el("td", { text: x.device + (x.current ? " (this one)" : "") }), el("td", {}, [el("code", { text: x.ip || "–" })]), el("td", { text: ago(x.createdAt) }), el("td", { text: ago(x.lastSeen) }),
            el("td", {}, [el("button", { class: "btn small", type: "button", text: x.current ? "Sign out" : "End", onClick: () => revoke(x.id, x.current) })]),
          ]))),
        ]) : el("div", { class: "empty", text: r.protectionsActive ? "No active sessions." : "Sessions can't be listed until the migration is run." }),
        el("div", { class: "row" }, [everywhere]),
      ]),
      el("div", { class: "card tablewrap" }, [
        el("h2", { text: "Recent sign-in activity" }),
        r.events.length ? el("table", {}, [
          el("thead", {}, [el("tr", {}, ["When", "What", "Address"].map((x) => el("th", { text: x })))]),
          el("tbody", {}, r.events.map((e) => el("tr", {}, [el("td", { text: ago(e.at) }), el("td", { text: EVENT_LABELS[e.action] || e.action }), el("td", {}, [el("code", { text: e.ip || "–" })])]))),
        ]) : el("div", { class: "empty", text: "Nothing recorded yet." }),
      ]),
    ])
  );
}

// ---------------------------------------------------------------- placements
const SLOT_NAMES = { news_list: "In the news list", news_top: "Top of a story", news_inline: "Middle of a story", news_bottom: "End of a story" };
const rate = (v) => (v == null ? "–" : (v * 100).toFixed(v < 0.1 ? 2 : 1) + "%");

async function viewPlacements(main) {
  const r = await api("placements_report");
  if (!r.ready) {
    main.replaceChildren(...header("Placements", "How often each ad or promotion space is seen and tapped."), el("div", { class: "card" }, [el("p", { class: "sub", text: "Counting isn't switched on yet." })]));
    return;
  }
  const stat = (num, lbl) => el("div", { class: "card stat" }, [el("div", { class: "num", text: num }), el("div", { class: "lbl", text: lbl })]);
  const stateTone = { live: "ok", scheduled: "warn", ended: "bad", off: "" };
  main.replaceChildren(
    ...header("Placements", "How often each ad or promotion space is seen and tapped, last 30 days. Counts only: no person, device or address is stored."),
    el("div", { class: "stack" }, [
      el("div", { class: "grid" }, [stat(String(r.totals.views), "Views"), stat(String(r.totals.clicks), "Taps"), stat(rate(r.totals.ctr), "Tap rate")]),
      barChart({ title: "Views per day", days: r.days, stacks: [{ label: "Views", key: "views", tone: "tone-a" }], hint: "A view is counted when at least half of the space has been on screen for a second, once per visit. People who send Do Not Track or Global Privacy Control are not counted, so real figures are a little higher." }),
      barChart({ title: "Taps per day", days: r.days, stacks: [{ label: "Taps", key: "clicks", tone: "tone-c" }] }),
      el("div", { class: "card tablewrap" }, [
        el("h2", { text: "By space" }),
        el("table", {}, [
          el("thead", {}, [el("tr", {}, ["Space", "State", "Headline", "Views", "Taps", "Tap rate"].map((x) => el("th", { text: x })))]),
          el("tbody", {}, r.slots.map((s) => el("tr", {}, [
            el("td", { text: SLOT_NAMES[s.slot] || s.slot }),
            el("td", {}, [el("span", { class: "check " + (stateTone[s.state] || ""), text: s.label })]),
            el("td", { text: s.headline || "–" }), el("td", { text: String(s.views) }), el("td", { text: String(s.clicks) }), el("td", { text: rate(s.ctr) }),
          ]))),
        ]),
        el("p", { class: "sub", text: "Set the headline, link and run dates under Remote config > News placements." }),
      ]),
      el("div", { class: "card tablewrap" }, [
        el("h2", { text: "By campaign" }),
        r.slots.some((s) => s.campaigns.length) ? el("table", {}, [
          el("thead", {}, [el("tr", {}, ["Space", "Campaign", "Views", "Taps", "Tap rate"].map((x) => el("th", { text: x })))]),
          el("tbody", {}, r.slots.flatMap((s) => s.campaigns.map((c) => el("tr", {}, [el("td", { text: SLOT_NAMES[s.slot] || s.slot }), el("td", { text: (c.title || "") + (c.current ? "" : "") + " (" + c.campaign + ")" }), el("td", { text: String(c.views) }), el("td", { text: String(c.clicks) }), el("td", { text: rate(c.ctr) })])))),
        ]) : el("div", { class: "empty", text: "Nothing counted yet. Switch a space on and open a story." }),
        el("p", { class: "sub", text: "Changing a space's headline or link starts a new campaign, so each version has its own figures." }),
      ]),
    ])
  );
}

// ---------------------------------------------------------------- seo
async function viewSeo(main) {
  const first = await api("seo_audit", { siteOnly: true });
  const s = first.site;
  const check = (ok, title, detail) => el("div", { class: "check " + (ok ? "ok" : "bad") }, [el("strong", { text: (ok ? "OK: " : "Fix: ") + title }), el("span", { class: "sub", text: detail })]);
  const box = el("textarea", { id: "seo-paths", rows: "4", placeholder: "/club/529-barcelona\n/player/276-neymar\n/match/1234567" });
  const out = el("div", { class: "stack" });
  const run = el("button", { class: "btn small", type: "button", text: "Check these pages" });
  const runSample = el("button", { class: "btn small", type: "button", text: "Check a standard sample" });

  const show = (pages) => {
    out.replaceChildren(...pages.map((p) => {
      const errors = p.issues.filter((i) => i.level === "error").length, warns = p.issues.length - errors;
      const state = p.redirect ? "Redirects to " + p.redirect : p.status === 404 ? "404 Not found" : errors ? errors + " problem" + (errors > 1 ? "s" : "") : warns ? warns + " suggestion" + (warns > 1 ? "s" : "") : "No issues";
      return el("div", { class: "card" }, [
        el("h2", {}, [el("code", { text: p.path })]),
        el("p", { class: "sub", text: `${p.status}: ${state}` + (p.title ? `. Title (${p.title.length}): ${p.title}` : "") }),
        p.title ? el("p", { class: "sub", text: `Description (${p.description.length}): ${p.description}` }) : null,
        p.title ? el("p", { class: "sub", text: `Headings ${p.h1s}, internal links ${p.links}, readable text ${p.textLength} characters, structured data: ${p.types.join(", ") || "none"}` }) : null,
        ...p.issues.map((i) => el("div", { class: "check " + (i.level === "error" ? "bad" : "warn"), }, [el("strong", { text: (i.level === "error" ? "Problem: " : "Suggestion: ") + i.code }), el("span", { class: "sub", text: i.message })])),
      ]);
    }));
  };
  const go = async (button, paths) => {
    button.disabled = true;
    try { show((await api("seo_audit", { paths })).pages); } catch (err) { toast(err.message, true); }
    button.disabled = false;
  };
  run.addEventListener("click", () => go(run, box.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)));
  runSample.addEventListener("click", () => go(runSample, []));

  main.replaceChildren(
    ...header("SEO", "What search engines and link previews see, and whether the setup is complete."),
    el("div", { class: "stack" }, [
      el("div", { class: "card" }, [
        el("h2", { text: "Site setup" }),
        check(s.siteUrlSet && s.https, "Public address (SITE_URL)", s.siteUrlSet ? s.origin : "Set SITE_URL to your https address so canonical links, sitemaps and link previews never use a preview address."),
        check(s.googleVerification, "Google Search Console", s.googleVerification ? "Verification tag is set." : "Add GOOGLE_SITE_VERIFICATION (the content of the verification tag) to claim the site, then submit /sitemap.xml."),
        check(s.bingVerification, "Bing Webmaster Tools", s.bingVerification ? "Verification tag is set." : "Optional: add BING_SITE_VERIFICATION. Bing also powers several other search engines."),
        check(s.footballApi, "Football data for club, player, venue and match pages", s.footballApi ? "Connected." : "Without it those pages are served with titles only."),
        check(s.newsApi, "News for the news sitemap and feed", s.newsApi ? "Connected." : "Without NEWS_ACCESS the news sitemap and /feed.xml are empty."),
        el("p", { class: "sub", text: `Crawlers have used ${s.crawlerCallsToday} of ${s.crawlerCallsCap} football API requests today (SEO_MAX_CALLS_PER_DAY). Club pages in the sitemap: ${s.clubsInSitemap ? "on" : "off (SITEMAP_CLUBS=1)"}. AI crawlers: ${s.aiCrawlers} (AI_CRAWLERS).` }),
        el("p", { class: "sub", text: "Sitemap index: /sitemap.xml. News feed: /feed.xml. Site summary for AI assistants: /llms.txt." }),
      ]),
      el("div", { class: "card" }, [
        el("h2", { text: "Check pages" }),
        el("p", { class: "sub", text: "Shows each page as a search engine receives it and lists problems (missing or overlong titles and descriptions, wrong canonical, accidental noindex, missing headings or structured data, thin content). Every check of a club, player, match or league page uses football API requests, counted against the crawler limit above." }),
        el("div", { class: "field" }, [el("label", { for: "seo-paths", text: "Addresses, one per line (up to 8)" }), box]),
        el("div", { class: "row" }, [run, runSample]),
      ]),
      out,
    ])
  );
}

// ---------------------------------------------------------------- usage
// A bar chart made of plain elements (the page's CSP forbids inline styles and scripts; setting
// style from script is allowed). stacks: [{ label, key, tone }] drawn bottom to top.
function barChart({ title, days, stacks, hint, format = (v) => String(v) }) {
  const totals = days.map((d) => stacks.reduce((t, s) => t + (d[s.key] || 0), 0));
  const max = Math.max(1, ...totals);
  const cols = days.map((d, i) => {
    const col = el("div", { class: "chart-col", title: `${d.day}: ` + stacks.map((s) => `${s.label} ${format(d[s.key] || 0)}`).join(", ") }, []);
    const stack = el("div", { class: "chart-stack" }, []);
    stack.style.height = Math.round((totals[i] / max) * 100) + "%";
    for (const s of stacks) {
      const v = d[s.key] || 0;
      if (!v) continue;
      const seg = el("div", { class: "chart-seg " + s.tone }, []);
      seg.style.flexGrow = String(v);
      stack.append(seg);
    }
    col.append(el("div", { class: "chart-area" }, [stack]), el("div", { class: "chart-day", text: d.day.slice(8) + "/" + d.day.slice(5, 7) }));
    return col;
  });
  return el("div", { class: "card" }, [
    el("h2", { text: title }),
    el("div", { class: "legend" }, stacks.map((s) => el("span", { class: "legend-item" }, [el("i", { class: "legend-dot " + s.tone }), s.label]))),
    el("div", { class: "chart" }, cols),
    hint ? el("p", { class: "sub", text: hint }) : null,
  ]);
}

async function viewUsage(main) {
  const u = await api("usage_overview");
  const pctOrDash = (v) => (v == null ? "–" : Math.round(v * 100) + "%");
  const stat = (num, lbl) => el("div", { class: "card stat" }, [el("div", { class: "num", text: num }), el("div", { class: "lbl", text: lbl })]);
  const rate = (key) => u.days.map((d) => ({ day: d.day, [key]: d[key] == null ? 0 : Math.round(d[key] * 100) }));
  const top = u.endpoints[0];
  main.replaceChildren(
    ...header("Usage", "Football data API requests and how well caching is working, last 14 days."),
    el("div", { class: "stack" }, [
      el("div", { class: "grid" }, [
        stat(u.quota ? `${u.quota.used} of ${u.quota.limit}` : "–", "Football API requests used today (all sources)"),
        stat(String(u.totals.calls14d), "Provider requests, 14 days"),
        stat(pctOrDash(u.totals.deviceHitRate14d), "Lookups answered on the device, 14 days"),
        stat(top ? top.endpoint : "–", top ? `Most-used endpoint (${top.calls} requests)` : "Most-used endpoint"),
      ]),
      barChart({ title: "Football API requests per day", days: u.days, stacks: [{ label: "The app", key: "proxy", tone: "tone-a" }, { label: "Prediction jobs", key: "cron", tone: "tone-b" }, { label: "Push alerts", key: "push", tone: "tone-c" }], hint: "Counted when a request actually reaches the football provider. Requests answered by the shared cache don't appear here, which is the point." }),
      barChart({ title: "Cache hit rate: on the device", days: rate("deviceHitRate"), stacks: [{ label: "% answered without asking the server", key: "deviceHitRate", tone: "tone-a" }], format: (v) => v + "%", hint: "Share of the app's data lookups answered from memory or the copy saved on the phone. Days with fewer than 20 reported lookups are left blank." }),
      barChart({ title: "Cache hit rate: shared edge cache (estimate)", days: rate("edgeHitRate"), stacks: [{ label: "% of server lookups that didn't reach the provider", key: "edgeHitRate", tone: "tone-b" }], format: (v) => v + "%", hint: "Estimated from what the apps report versus what reached the provider, so it is only as complete as those reports." }),
      barChart({ title: "Push alerts sent per day", days: u.days, stacks: [{ label: "Delivered to the push service", key: "pushSent", tone: "tone-c" }, { label: "Failed", key: "pushFailed", tone: "tone-d" }] }),
      el("div", { class: "card tablewrap" }, [el("h2", { text: "Busiest endpoints, 14 days" }), u.endpoints.length ? el("table", {}, [
        el("thead", {}, [el("tr", {}, ["Endpoint", "Requests"].map((x) => el("th", { text: x })))]),
        el("tbody", {}, u.endpoints.map((e) => el("tr", {}, [el("td", {}, [el("code", { text: e.endpoint })]), el("td", { text: String(e.calls) })]))),
      ]) : el("div", { class: "empty", text: "Nothing counted yet. Use the app and check back." })]),
    ])
  );
}

// ---------------------------------------------------------------- predictions
const pc = (v) => (v == null ? "–" : Math.round(v * 1000) / 10 + "%");
const dec = (v, d = 3) => (v == null ? "–" : Number(v).toFixed(d));

async function viewPredictions(main) {
  const r = await api("predictions_overview");
  const h = r.headline || {};
  const c = r.counts || {};
  const stat = (num, lbl) => el("div", { class: "card stat" }, [el("div", { class: "num", text: num }), el("div", { class: "lbl", text: lbl })]);

  const runJob = async (task, button) => {
    button.disabled = true;
    try {
      const { result } = await api("predictions_run", { task });
      toast(task === "predict" ? (result.skipped ? `Nothing recorded: ${result.skipped}.` : `Recorded ${result.predicted} predictions for the next ${result.days} days (${result.callsUsed} football API calls${result.uncovered ? `; ${result.uncovered} matches wait for tomorrow's run` : ""}).`) : `Graded ${result.graded} of ${result.pending} waiting matches (${result.callsUsed} calls).`);
      route();
    } catch (err) { toast(err.message, true); button.disabled = false; }
  };
  const predictBtn = el("button", { class: "btn small", type: "button", text: "Record predictions now" });
  const gradeBtn = el("button", { class: "btn small", type: "button", text: "Grade finished matches now" });
  predictBtn.addEventListener("click", () => runJob("predict", predictBtn));
  gradeBtn.addEventListener("click", () => runJob("grade", gradeBtn));

  const calTable = (title, rows) => el("div", { class: "card tablewrap" }, [el("h2", { text: title }), rows.length ? el("table", {}, [
    el("thead", {}, [el("tr", {}, ["We said", "Matches", "Said on average", "Actually happened"].map((x) => el("th", { text: x })))]),
    el("tbody", {}, rows.map((b) => el("tr", {}, [el("td", { text: Math.round(b.from * 100) + "–" + Math.round(b.to * 100) + "%" }), el("td", { text: String(b.n) }), el("td", { text: pc(b.predicted) }), el("td", { text: pc(b.actual) })]))),
  ]) : el("div", { class: "empty", text: "Needs graded matches." })]);

  const versus = (name, v) => {
    if (!v || !v.n) return el("div", { class: "card" }, [el("h2", { text: "Scoutwave vs " + name }), el("p", { class: "sub", text: name === "Forebet" ? "Nothing entered yet. Add Forebet's pre-match numbers below for matches Scoutwave tracks." : "No bookmaker odds recorded yet (set PREDICT_ODDS=1)." })]);
    const row = (label, a, b, fmt) => el("tr", {}, [el("td", { text: label }), el("td", { text: fmt(a) }), el("td", { text: fmt(b) })]);
    return el("div", { class: "card tablewrap" }, [el("h2", { text: `Scoutwave vs ${name} · ${v.n} matches` }), el("table", {}, [
      el("thead", {}, [el("tr", {}, ["", "Scoutwave", name].map((x) => el("th", { text: x })))]),
      el("tbody", {}, [
        v.probs.n ? row(`Brier score, lower is better (${v.probs.n} matches)`, v.probs.scoutwave.brier, v.probs.other.brier, (x) => dec(x)) : null,
        v.probs.n ? row("Log loss, lower is better", v.probs.scoutwave.logLoss, v.probs.other.logLoss, (x) => dec(x)) : null,
        v.probs.n ? row("Winner picked right", v.probs.scoutwave.winner, v.probs.other.winner, pc) : null,
        v.scores.n ? row(`Exact score (${v.scores.n} matches)`, v.scores.scoutwave.exact, v.scores.other.exact, pc) : null,
        v.scores.n ? row("Real score in top 3", v.scores.scoutwave.top3, v.scores.other.top3, pc) : null,
        v.scores.n ? row("Real score in top 5", v.scores.scoutwave.top5, v.scores.other.top5, pc) : null,
      ]),
    ])]);
  };

  // The current model against an older version, on the matches both predicted (same data, same scoring).
  const modelCard = (current, m) => {
    if (!m.n) return el("div", { class: "card" }, [el("h2", { text: `${current} vs ${m.model}` }), el("p", { class: "sub", text: `${m.model} is recorded beside ${current} on the same matches. Nothing graded on both yet.` })]);
    const row = (label, a, b, fmt) => el("tr", {}, [el("td", { text: label }), el("td", { text: fmt(a) }), el("td", { text: fmt(b) })]);
    return el("div", { class: "card tablewrap" }, [el("h2", { text: `${current} vs ${m.model} · ${m.n} matches both predicted` }), el("table", {}, [
      el("thead", {}, [el("tr", {}, ["", current, m.model].map((x) => el("th", { text: x })))]),
      el("tbody", {}, [
        row("Log loss, lower is better", m.current.logLoss, m.other.logLoss, (x) => dec(x)),
        row("Brier score, lower is better", m.current.brier, m.other.brier, (x) => dec(x)),
        row("Winner picked right", m.current.winnerAccuracy, m.other.winnerAccuracy, pc),
        row("Over/under 2.5 right", m.current.overUnderAccuracy, m.other.overUnderAccuracy, pc),
        row("Both teams score right", m.current.bttsAccuracy, m.other.bttsAccuracy, pc),
        row("Exact score", m.current.exactScore, m.other.exactScore, pc),
        row("Real score in top 3", m.current.top3Score, m.other.top3Score, pc),
        row("Real score in top 5", m.current.top5Score, m.other.top5Score, pc),
      ]),
    ]), el("p", { class: "sub", text: "Judge by log loss over a few hundred matches. A few dozen is mostly luck." })]);
  };

  const box = el("textarea", { id: "forebet-text", rows: "6", placeholder: "2026-10-20,Arsenal,Chelsea,52,25,23,2-1,1-0,2-0,1-1,3-1" });
  const importBtn = el("button", { class: "btn small", type: "button", text: "Save comparison rows" });
  const importOut = el("p", { class: "sub" });
  importBtn.addEventListener("click", async () => {
    importBtn.disabled = true;
    try {
      const out = await api("benchmark_import", { text: box.value });
      importOut.textContent = `Saved ${out.saved}${out.late ? ` (${out.late} entered after kick-off: kept but left out of comparisons)` : ""}.` + (out.problems.length ? " Problems: " + out.problems.slice(0, 8).join(" | ") : "");
      if (out.saved) box.value = "";
    } catch (err) { toast(err.message, true); }
    importBtn.disabled = false;
  });

  main.replaceChildren(
    ...header("Predictions", `Server-side tracking of model ${r.model}: recorded before kick-off, graded on the 90-minute result.`),
    el("div", { class: "stack" }, [
      el("div", { class: "grid" }, [
        stat(String(c.total ?? 0), `Matches tracked · ${c.pending ?? 0} waiting · ${c.graded ?? 0} graded`),
        stat(pc(h.winnerAccuracy), `Winner picked right (${h.n || 0} matches)`),
        stat(dec(h.brier), "Brier score (0.667 = guessing)"),
        stat(dec(h.logLoss), "Log loss (1.099 = guessing)"),
      ]),
      el("div", { class: "grid" }, [
        stat(pc(h.exactScore), "Exact score"), stat(pc(h.top3Score), "Real score in top 3"), stat(pc(h.top5Score), "Real score in top 5"),
        stat(`${pc(h.overUnderAccuracy)} / ${pc(h.bttsAccuracy)}`, "Over/under 2.5 / both teams score"),
      ]),
      el("div", { class: "card" }, [
        el("h2", { text: "Publishing" }),
        el("p", { class: "sub", text: r.publishReady ? `Enough matches graded (${r.publishNeeds}+). The app can show a real accuracy figure.` : `${h.n || 0} of ${r.publishNeeds} graded matches needed before the app shows an accuracy figure. Until then it only shows the count.` }),
        el("div", { class: "row" }, [predictBtn, gradeBtn]),
      ]),
      ...(r.modelCompare || []).map((m) => modelCard(r.model, m)),
      versus("the bookmaker market", r.versus?.market),
      versus("Forebet", r.versus?.forebet),
      el("div", { class: "card" }, [
        el("h2", { text: "Add Forebet's predictions by hand" }),
        el("p", { class: "sub", text: "One match per line: date, home team, away team, home %, draw %, away %, then their likeliest score and up to four more. Only enter numbers you read before kick-off; lines saved after kick-off are kept but never counted." }),
        el("div", { class: "field" }, [box]),
        el("div", { class: "row" }, [importBtn]), importOut,
      ]),
      el("div", { class: "grid" }, [calTable("Calibration: match result", r.calibration?.outcome || []), calTable("Calibration: over 2.5 goals", r.calibration?.over25 || []), calTable("Calibration: both teams score", r.calibration?.btts || [])]),
      el("div", { class: "card tablewrap" }, [el("h2", { text: "Latest graded" }), r.recent?.length ? el("table", {}, [
        el("thead", {}, [el("tr", {}, ["Match", "Result", "Our pick", "Real score ranked"].map((x) => el("th", { text: x })))]),
        el("tbody", {}, r.recent.map((m) => el("tr", {}, [el("td", { text: `${m.home} v ${m.away}` }), el("td", { text: m.score }), el("td", { text: `${m.pick || "–"} ${m.pickCorrect ? "✓" : "✗"}` }), el("td", { text: m.topScoreRank ? "#" + m.topScoreRank : "outside grid" })]))),
      ]) : el("div", { class: "empty", text: "Nothing graded yet." })]),
    ])
  );
}

// ---------------------------------------------------------------- boot
// ---------------------------------------------------------------- shared pieces
const SVG_NS = "http://www.w3.org/2000/svg";
// Small line icons (24x24 grid). Several shapes in one icon are separated by "|".
const ICONS = {
  home: "M3 11l9-8 9 8|M5 10v10h14V10",
  chart: "M4 20V10|M10 20V4|M16 20v-7|M22 20H2",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  mail: "M4 5h16v14H4z|M4 6l8 7 8-7",
  users: "M16 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1|M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7|M21 20v-1a4 4 0 00-3-3.9|M16 4.2a3.5 3.5 0 010 6.6",
  bell: "M6 16v-5a6 6 0 1112 0v5l2 2H4z|M10 20a2 2 0 004 0",
  sliders: "M4 6h10|M18 6h2|M4 12h4|M12 12h8|M4 18h12|M14 4v4|M8 10v4|M16 16v4",
  target: "M12 21a9 9 0 100-18 9 9 0 000 18|M12 16a4 4 0 100-8 4 4 0 000 8",
  layout: "M4 4h16v16H4z|M4 10h16|M10 10v10",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14|M21 21l-5-5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  list: "M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01",
  refresh: "M20 11a8 8 0 00-14.5-4M4 4v4h4|M4 13a8 8 0 0014.5 4M20 20v-4h-4",
  download: "M12 4v11|M7 11l5 5 5-5|M5 20h14",
  chevron: "M9 6l6 6-6 6",
};
function icon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "ico"); svg.setAttribute("aria-hidden", "true");
  for (const d of (ICONS[name] || "").split("|")) { const path = document.createElementNS(SVG_NS, "path"); path.setAttribute("d", d); svg.append(path); }
  return svg;
}

// A tiny trend line for a card (values oldest to newest).
function sparkline(values) {
  const w = 120, h = 36, max = Math.max(1, ...values), step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - (v / max) * (h - 8)).toFixed(1)}`);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("class", "spark"); svg.setAttribute("aria-hidden", "true");
  const area = document.createElementNS(SVG_NS, "path"); area.setAttribute("class", "spark-area"); area.setAttribute("d", `M0,${h} L${pts.join(" L")} L${w},${h} Z`);
  const line = document.createElementNS(SVG_NS, "polyline"); line.setAttribute("class", "spark-line"); line.setAttribute("points", pts.join(" "));
  svg.append(area, line);
  return svg;
}

// A headline number with an optional trend line.
function kpi(label, value, sub, trend) {
  return el("div", { class: "card kpi" }, [
    el("div", { class: "kpi-top" }, [el("span", { class: "lbl", text: label })]),
    el("div", { class: "num", text: value }),
    sub ? el("div", { class: "kpi-sub", text: sub }) : null,
    trend && trend.length > 1 ? sparkline(trend) : null,
  ]);
}

// Horizontal bars: [{ label, value }], each as a share of the total (or of `of`).
function hbars(items, of) {
  const total = Math.max(1, of ?? items.reduce((t, i) => t + i.value, 0));
  if (!items.length) return el("p", { class: "sub", text: "Nothing to show yet." });
  return el("div", { class: "hbars" }, items.map((i) => {
    const bar = el("div", { class: "bar" }, [el("span")]);
    bar.firstChild.style.width = Math.round(Math.min(100, (i.value / total) * 100)) + "%";
    return el("div", { class: "hbar" }, [el("span", { class: "hbar-label", text: i.label }), bar, el("span", { class: "hbar-val", text: String(i.value) })]);
  }));
}

const skeleton = () => el("div", { class: "stack", "aria-busy": "true", "aria-label": "Loading" }, [
  el("div", { class: "skel skel-title" }),
  el("div", { class: "grid" }, [1, 2, 3, 4].map(() => el("div", { class: "card skel skel-card" }))),
  el("div", { class: "card skel skel-block" }),
]);

// A CSV that opens cleanly in a spreadsheet, and can't run a formula when opened there.
const csvCell = (v) => {
  let t = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};
function downloadCsv(name, rows) {
  const blob = new Blob(["\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = el("a", { href: url, download: name });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Search and jump (Ctrl/Cmd + K): sections, a user lookup, and sign out.
function openPalette() {
  if (!session.token || document.querySelector("dialog.palette")) return;
  const input = el("input", { type: "search", placeholder: "Jump to a section, or type an email to find a user…", "aria-label": "Search and jump", autocomplete: "off" });
  const list = el("div", { class: "palette-list", role: "listbox" });
  const dlg = el("dialog", { class: "palette", "aria-label": "Search and jump" }, [input, list]);
  let items = [], sel = 0;
  const go = (it) => { dlg.close(); it.run(); };
  const build = () => {
    const raw = input.value.trim(), t = raw.toLowerCase();
    items = [];
    for (const [id, label, ic] of NAV.flatMap(([, i]) => i)) if (!t || label.toLowerCase().includes(t) || id.includes(t)) items.push({ label: "Go to " + label, ic, run: () => { location.hash = "#/" + id; } });
    if (raw) items.push({ label: `Find users matching “${raw}”`, ic: "users", run: () => { location.hash = "#/users?q=" + encodeURIComponent(raw); route(); } });
    if (!t || "sign out".includes(t)) items.push({ label: "Sign out", ic: "shield", run: () => logout() });
    sel = Math.max(0, Math.min(sel, items.length - 1));
    list.replaceChildren(...(items.length ? items.map((it, i) => el("button", { class: "palette-item", type: "button", role: "option", "aria-selected": String(i === sel), onClick: () => go(it) }, [icon(it.ic), el("span", { text: it.label })])) : [el("p", { class: "empty", text: "Nothing matches." })]));
  };
  input.addEventListener("input", () => { sel = 0; build(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && items.length) { e.preventDefault(); sel = (sel + 1) % items.length; build(); }
    else if (e.key === "ArrowUp" && items.length) { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; build(); }
    else if (e.key === "Enter" && items[sel]) { e.preventDefault(); go(items[sel]); }
  });
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  document.body.append(dlg);
  build(); dlg.showModal(); input.focus();
}
document.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); } });

// ---------------------------------------------------------------- insights
async function viewInsights(main) {
  const r = await api("insights");
  let range = 30;
  const body = el("div", { class: "stack" });
  const unavailable = (title) => el("div", { class: "card" }, [el("h2", { text: title }), el("p", { class: "sub", text: "Not available yet. The data for this part can't be read right now." })]);
  const ranges = [[7, "7 days"], [30, "30 days"]];
  const pills = ranges.map(([n, label]) => el("button", { class: "pill", type: "button", "aria-pressed": String(n === range), text: label, onClick: () => { range = n; pills.forEach((p, i) => p.setAttribute("aria-pressed", String(ranges[i][0] === n))); draw(); } }));

  function draw() {
    const u = r.users, m = r.messages, pr = r.predictions, ps = r.push;
    const share = (n, of) => (of ? Math.round((n / of) * 100) + "%" : "–");
    const parts = [];
    parts.push(u ? el("div", { class: "grid six" }, [
      kpi("Total accounts", String(u.total), u.capped ? "First 5,000 accounts" : "Everyone who signed up", u.signups.map((d) => d.signups)),
      kpi(`New in ${range} days`, String(range === 7 ? u.new7 : u.new30), range === 7 ? `${u.new30} in 30 days` : `${u.new7} in the last 7`),
      kpi("Active in 7 days", String(u.active7), `${share(u.active7, u.total)} of accounts · ${u.active1} today`),
      kpi("Active in 30 days", String(u.active30), `${share(u.active30, u.total)} of accounts`),
      kpi("Premium", String(u.premium), `${share(u.premium, u.total)} of accounts · ${u.coins} coins held`),
      kpi("Alert devices", ps ? String(ps.devices) : "–", ps ? `${ps.signedIn} signed in` : ""),
    ]) : unavailable("Audience"));
    if (u) parts.push(barChart({ title: `New accounts per day, last ${range} days`, days: u.signups.slice(-range), stacks: [{ label: "New accounts", key: "signups", tone: "tone-a" }] }));
    if (u) parts.push(el("div", { class: "grid wide" }, [
      el("div", { class: "card" }, [el("h2", { text: "When people were last seen" }), hbars([
        { label: "In the last 24 hours", value: u.lastSeen.today }, { label: "2 to 7 days ago", value: u.lastSeen.week }, { label: "8 to 30 days ago", value: u.lastSeen.month },
        { label: "More than 30 days ago", value: u.lastSeen.older }, { label: "Never signed in", value: u.lastSeen.never }], u.total)]),
      el("div", { class: "card" }, [el("h2", { text: "How people sign in" }), hbars(Object.entries(u.providers).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })), u.total),
        el("div", { class: "row" }, [el("span", { class: "chip " + (u.unconfirmed ? "warn" : ""), text: `${u.unconfirmed} unconfirmed` }), el("span", { class: "chip " + (u.banned ? "bad" : ""), text: `${u.banned} banned` })])]),
    ]));
    parts.push(m ? barChart({ title: `Messages received per day, last ${range} days`, days: m.perDay.slice(-range), stacks: [{ label: "Messages", key: "messages", tone: "tone-b" }] }) : unavailable("Messages"));
    if (m) parts.push(el("div", { class: "grid wide" }, [
      el("div", { class: "card" }, [el("h2", { text: "Feedback, last 30 days" }),
        el("div", { class: "row" }, [el("span", { class: "chip " + (m.status.new ? "warn" : ""), text: `${m.status.new} new` }), el("span", { class: "chip", text: `${m.status.read} read` }), el("span", { class: "chip ok", text: `${m.status.resolved} resolved` })]),
        el("p", { class: "sub", text: m.avgRating == null ? "No star ratings yet." : `Average rating ${m.avgRating} of 5, from ${m.rated} rating${m.rated === 1 ? "" : "s"}.` }),
        hbars(Object.entries(m.kinds).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })), m.total)]),
      el("div", { class: "card" }, [el("h2", { text: "Alert devices" }), ps ? hbars([
        { label: "Goal alerts", value: ps.goals }, { label: "Kick-off alerts", value: ps.kickoff }, { label: "Half-time and full-time", value: ps.whistles }, { label: "Signed-in users", value: ps.signedIn }, { label: "Failing to receive", value: ps.failing }], ps.devices)
        : el("p", { class: "sub", text: "Not available yet." }),
        ps && !ps.configured ? el("p", { class: "sub", text: "Alerts are switched off for this site, so nothing is being sent." }) : null]),
    ]));
    parts.push(pr ? barChart({ title: "Matches with a prediction, next 7 days", days: pr.upcoming, stacks: [{ label: "Predictions recorded", key: "predictions", tone: "tone-c" }], hint: "Fills up as the daily run reaches each day. Matches not yet reached are picked up by the next run." }) : unavailable("Predictions"));
    if (pr) parts.push(el("div", { class: "grid wide" }, [
      el("div", { class: "card" }, [el("h2", { text: "Prediction pipeline" }), hbars([{ label: "Waiting for the result", value: pr.status.pending }, { label: "Graded", value: pr.status.graded }, { label: "Voided", value: pr.status.void }]), el("p", { class: "sub", text: `Model ${pr.model}. Accuracy is on the Predictions page.` })]),
      el("div", { class: "card" }, [el("h2", { text: "Busiest leagues ahead" }), hbars(pr.topLeagues.map((l) => ({ label: l.league, value: l.count })))]),
    ]));
    body.replaceChildren(...parts);
  }
  main.replaceChildren(...header("Insights", "Who is using Scoutwave, what they say, and how predictions and alerts are doing.", [...pills, refreshButton()]), body);
  draw();
}

// ---------------------------------------------------------------- broadcast
async function viewBroadcast(main) {
  const first = await api("broadcast_preview", { audience: "all" });
  let recipients = first.count;
  const aud = el("select", { id: "bc-aud", "aria-label": "Who gets this" }, Object.entries(first.audiences).map(([v, l]) => el("option", { value: v, text: l })));
  const title = el("input", { id: "bc-title", type: "text", maxlength: "60", placeholder: "e.g. Predictions are live", autocomplete: "off" });
  const text = el("textarea", { id: "bc-body", maxlength: "140", placeholder: "One or two short sentences." });
  const link = el("input", { id: "bc-url", type: "text", maxlength: "200", placeholder: "/ (home), or a page like /news", autocomplete: "off" });
  const count = el("span", { class: "chip", text: `${first.count} device${first.count === 1 ? "" : "s"}` });
  const send = el("button", { class: "btn primary", type: "button" }, [icon("bell"), "Send broadcast"]);
  const result = el("div");
  const pvTitle = el("strong", { text: "Your title" }), pvBody = el("span", { text: "Your message appears here." });
  const counter = (input, max) => el("span", { class: "hint", text: `0 / ${max}` });
  const titleCount = counter(title, 60), textCount = counter(text, 140);
  const sync = () => {
    pvTitle.textContent = title.value.trim() || "Your title"; pvBody.textContent = text.value.trim() || "Your message appears here.";
    titleCount.textContent = `${title.value.length} / 60`; textCount.textContent = `${text.value.length} / 140`;
    send.disabled = !first.configured || !title.value.trim() || !text.value.trim() || !recipients;
  };
  title.addEventListener("input", sync); text.addEventListener("input", sync);
  aud.addEventListener("change", async () => {
    count.textContent = "Counting…"; recipients = 0; sync();
    try { const c = await api("broadcast_preview", { audience: aud.value }); recipients = c.count; count.textContent = `${c.count} device${c.count === 1 ? "" : "s"}`; } catch (e) { count.textContent = "–"; toast(e.message, true); }
    sync();
  });
  send.addEventListener("click", async () => {
    const ok = await confirmDialog({ title: `Send to ${recipients} device${recipients === 1 ? "" : "s"}?`, message: `“${title.value.trim()}”\n${text.value.trim()}\n\nIt goes out right away and can't be recalled.`, ok: "Send now", danger: true });
    if (!ok) return;
    send.disabled = true;
    try {
      const out = await api("broadcast_send", { audience: aud.value, title: title.value, body: text.value, url: link.value, confirm: true });
      toast(`Sent to ${out.sent} device${out.sent === 1 ? "" : "s"}`);
      result.replaceChildren(el("div", { class: "card" }, [el("h2", { text: "Sent" }), el("div", { class: "row" }, [el("span", { class: "chip ok", text: `${out.sent} delivered` }), el("span", { class: "chip " + (out.failed ? "warn" : ""), text: `${out.failed} failed` }), el("span", { class: "chip", text: `${out.removed} dead devices removed` })]), el("p", { class: "sub", text: "“Delivered” means the push service accepted it. Devices that are off or offline get it when they are back." })]));
      title.value = ""; text.value = ""; link.value = "";
    } catch (e) { toast(e.message, true); }
    sync();
  });
  main.replaceChildren(
    ...header("Broadcast", "Send a notification from the team to devices that have alerts turned on."),
    el("div", { class: "split" }, [
      el("div", { class: "card stack" }, [
        first.configured ? null : el("div", { class: "preview warn", text: "Alerts are switched off for this site, so nothing can be sent yet." }),
        el("div", { class: "field" }, [el("label", { for: "bc-aud", text: "Who gets it" }), aud, el("div", { class: "row" }, [count, el("span", { class: "hint", text: "currently reachable" })])]),
        el("div", { class: "field" }, [el("label", { for: "bc-title", text: "Title" }), title, titleCount]),
        el("div", { class: "field" }, [el("label", { for: "bc-body", text: "Message" }), text, textCount]),
        el("div", { class: "field" }, [el("label", { for: "bc-url", text: "Opens this page (optional)" }), link, el("span", { class: "hint", text: "A page of the app, starting with /. Leave empty for the home screen." })]),
        el("div", { class: "row" }, [send, el("span", { class: "hint", text: "One broadcast every 10 minutes." })]),
      ]),
      el("div", { class: "stack" }, [
        el("div", { class: "card" }, [el("h2", { text: "Preview" }), el("div", { class: "notif" }, [el("span", { class: "brand-dot" }), el("div", {}, [el("small", { text: "Scoutwave · now" }), pvTitle, pvBody])]), el("p", { class: "sub", text: "Phones and computers show it like this, even when the app is closed." })]),
        result,
      ]),
    ])
  );
  sync();
}

window.addEventListener("hashchange", () => { if (session.token) route(); });
(async function start() {
  if (session.token && session.expires > Date.now()) {
    try { await api("me"); renderShell(); return; } catch { /* fall through to login */ }
  }
  session.clear();
  // An empty login is a harmless probe: 400 when the area is configured, 503 when it is not.
  try { await api("login", { password: "" }); } catch (err) { renderLogin("", err.code === "NOT_CONFIGURED"); return; }
  renderLogin();
})();
