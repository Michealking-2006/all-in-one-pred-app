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
const VIEWS = [["overview", "Overview"], ["config", "Remote config"], ["messages", "Messages"], ["users", "Users"], ["usage", "Usage"], ["security", "Security"], ["predictions", "Predictions"], ["audit", "Audit log"]];

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
      ? el("p", { text: "This area isn't set up yet. Follow docs/ADMIN.md, add the environment variables in Vercel and redeploy." })
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
  const nav = el("nav", { class: "side", "aria-label": "Sections" }, [
    el("div", { class: "brand" }, [el("span", { class: "brand-dot" }), "Control room"]),
    ...VIEWS.map(([id, label]) => el("button", { class: "nav-btn", type: "button", "data-view": id, "aria-current": id === view ? "page" : null, onClick: () => { location.hash = "#/" + id; } }, [label, id === "messages" ? el("span", { class: "count", id: "msg-count", hidden: true }) : null])),
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
  main.replaceChildren(el("p", { class: "boot", text: "Loading…" }));
  const render = { overview: viewOverview, config: viewConfig, messages: viewMessages, users: viewUsers, usage: viewUsage, security: viewSecurity, predictions: viewPredictions, audit: viewAudit }[view];
  render(main).catch((err) => main.replaceChildren(el("div", { class: "error", role: "alert", text: err.message || "Could not load this section." })));
  main.focus({ preventScroll: true });
}

function header(title, subtitle) {
  return [el("h1", { text: title }), el("p", { class: "sub", text: subtitle })];
}

function updateInboxCount(n) {
  const badge = $("#msg-count");
  if (!badge) return;
  badge.hidden = !n;
  badge.textContent = String(n || "");
}

// ---------------------------------------------------------------- overview
async function viewOverview(main) {
  const data = await api("overview");
  overviewCache = data;
  updateInboxCount(data.inbox?.new);
  const f = data.football || {};
  const pct = f.ok && f.limit ? Math.min(100, Math.round((f.used / f.limit) * 100)) : null;
  const cfg = data.config || {};
  const bar = el("div", { class: "bar" + (pct >= 85 ? " hot" : ""), role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": pct ?? 0, "aria-label": "Football API requests used today" }, [el("span")]);
  bar.firstChild.style.width = (pct ?? 0) + "%";

  main.replaceChildren(
    ...header("Overview", "Health, usage and what is live right now."),
    el("div", { class: "stack" }, [
      el("div", { class: "grid" }, [
        el("div", { class: "card stat" }, [el("div", { class: "num", text: data.version }), el("div", { class: "lbl", text: `App version · ${data.deploy.env}${data.deploy.commit ? " · " + data.deploy.commit : ""}` })]),
        el("div", { class: "card stat" }, [el("div", { class: "num", text: data.users == null ? "–" : String(data.users) }), el("div", { class: "lbl", text: "Registered users" })]),
        el("div", { class: "card stat" }, [el("div", { class: "num", text: data.inbox?.new == null ? "–" : String(data.inbox.new) }), el("div", { class: "lbl", text: `New messages${data.inbox?.total != null ? " · " + data.inbox.total + " total" : ""}` })]),
        el("div", { class: "card stat" }, [
          el("div", { class: "num", text: pct == null ? "–" : pct + "%" }),
          el("div", { class: "lbl", text: f.ok ? `Football API today: ${f.used} of ${f.limit}` : "Football API quota unavailable" }),
          pct == null ? null : bar,
        ]),
      ]),
      el("div", { class: "grid" }, [
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
    ])
  );
}

function liveRow(label, tone, detail) {
  return el("div", { class: "health-row" }, [el("span", { class: "dot" + (tone === "ok" ? " ok" : tone === "warn" ? " warn" : ""), "aria-hidden": "true" }), el("div", {}, [el("strong", { text: label }), el("small", { text: detail })])]);
}

// ---------------------------------------------------------------- config
const FLAG_INFO = {
  predictions: ["Predictions", "Show Scoutwave's own prediction model on match pages and the VIP tab."],
  advancedThemes: ["Advanced themes", "Kill switch for Fire, Water, Ice and Bubbles. Turn off if they ever misbehave."],
  serverEntitlements: ["Account Premium and coins", "Signed-in users get Premium, coins and unlocks from their account (granted here, spent through the server). Guests keep the local demo. Needs migration 002 and payments are not connected yet."],
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

  main.replaceChildren(...header("Messages", "Feedback, issue reports and contact messages from the app."), el("div", { class: "filters" }, [...pills, search]), list, more);
  await load(true);
}

// ---------------------------------------------------------------- users
async function viewUsers(main) {
  const st = { page: 1, total: null, users: [], q: "" };
  const body = el("div", { class: "card tablewrap" });
  const pager = el("div", { class: "row" });
  const filter = el("input", { type: "search", placeholder: "Filter this page by email…", "aria-label": "Filter users" });
  filter.addEventListener("input", () => { st.q = filter.value.toLowerCase(); draw(); });

  async function load() {
    body.replaceChildren(el("p", { class: "boot", text: "Loading…" }));
    const data = await api("users_list", { page: st.page });
    st.users = data.users; st.total = data.total; draw();
  }
  function draw() {
    const rows = st.users.filter((u) => !st.q || u.email.toLowerCase().includes(st.q));
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
    ]) : el("div", { class: "empty", text: "No users on this page." }));
    pager.replaceChildren(
      el("button", { class: "btn small", type: "button", text: "Previous", disabled: st.page <= 1, onClick: () => { st.page--; load(); } }),
      el("span", { class: "sub", text: `Page ${st.page}${st.total ? " · " + st.total + " users" : ""}` }),
      el("button", { class: "btn small", type: "button", text: "Next", disabled: st.users.length < 50, onClick: () => { st.page++; load(); } })
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

  main.replaceChildren(...header("Users", "Everyone who has created a Scoutwave account."), el("div", { class: "filters" }, [filter]), body, pager);
  await load();
}

// ---------------------------------------------------------------- audit
async function viewAudit(main) {
  const { items } = await api("audit_list", { limit: 150 });
  main.replaceChildren(
    ...header("Audit log", "Every sign-in and change made from this dashboard."),
    el("div", { class: "card tablewrap" }, [items.length ? el("table", {}, [
      el("thead", {}, [el("tr", {}, ["When", "Action", "Details", "IP"].map((h) => el("th", { text: h })))]),
      el("tbody", {}, items.map((a) => el("tr", {}, [
        el("td", { title: when(a.at), text: ago(a.at) }),
        el("td", {}, [el("code", { text: a.action })]),
        el("td", { class: "audit-detail", text: a.detail && Object.keys(a.detail).length ? JSON.stringify(a.detail).slice(0, 300) : "" }),
        el("td", { class: "mono", text: a.ip || "" }),
      ]))),
    ]) : el("div", { class: "empty", text: "Nothing recorded yet." })])
  );
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
      r.protectionsActive && !r.degradedSession ? null : el("div", { class: "card notice bad" }, [el("strong", { text: "Reduced protection" }), el("p", { class: "sub", text: "Run supabase/migrations/006_admin_security.sql in the Supabase SQL editor, then sign in again. Until then lockouts only last as long as the server instance and sessions can't be listed or revoked." })]),
      el("div", { class: "card" }, [
        el("h2", { text: "Three layers on sign-in" }),
        item(r.twoFactor, "Required two-factor, every code works once", "A code that was seen can't be replayed. Without ADMIN_TOTP_SECRET nobody can sign in."),
        item(r.protectionsActive, "Lockout that survives restarts", "5 failures from one address lock it for 15 minutes, doubling each time (up to a day). 20 failures from anywhere in an hour lock sign-in for 15 minutes."),
        item(r.protectionsActive, `Server-side sessions, ${r.idleMinutes}-minute idle limit`, "Tied to the browser that signed in" + (r.bindIp ? " and its network (ADMIN_BIND_IP)" : "; set ADMIN_BIND_IP=1 to tie them to the network as well") + ". Revocable below."),
      ]),
      el("div", { class: "card" }, [
        el("h2", { text: "Page protection (Content-Security-Policy)" }),
        el("p", { class: "sub", text: "The app only runs its own scripts, so injected code can't run, and it can only talk to Scoutwave, Supabase and Formspree. Browsers report anything it blocks; a healthy site shows none." }),
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
      ]) : el("div", { class: "empty", text: "Nothing counted yet. Run supabase/migrations/005_usage_and_push.sql, then use the app." })]),
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
      toast(task === "predict" ? `Recorded ${result.predicted} predictions (${result.callsUsed} football API calls).` : `Graded ${result.graded} of ${result.pending} waiting matches (${result.callsUsed} calls).`);
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
