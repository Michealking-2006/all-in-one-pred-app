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
  if (res.status === 401 && data.code === "SESSION") { logout(); throw new Error(data.error || "Session ended."); }
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
const VIEWS = [["overview", "Overview"], ["config", "Remote config"], ["messages", "Messages"], ["users", "Users"], ["audit", "Audit log"]];

function logout() {
  session.clear();
  overviewCache = null;
  renderLogin();
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
    el("div", { class: "field" }, [el("label", { for: "f-code", text: "Authenticator code (if enabled)" }), code]),
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
      location.hash = "#/overview";
      renderShell();
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
      el("button", { class: "btn small", type: "button", text: "Sign out", onClick: logout }),
    ]),
  ]);
  const main = el("main", { class: "main", id: "main", tabindex: "-1" });
  $app.replaceChildren(el("div", { class: "shell" }, [nav, main]));
  clearInterval(sessionTimer);
  const tick = () => {
    const left = session.expires - Date.now();
    if (left <= 0) { logout(); return; }
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
  const render = { overview: viewOverview, config: viewConfig, messages: viewMessages, users: viewUsers, audit: viewAudit }[view];
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
};

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
    if (loaded.minVersion !== draft.minVersion) out.push(`Minimum version: ${draft.minVersion}`);
    if (JSON.stringify(loaded.fxPrices) !== JSON.stringify(draft.fxPrices)) out.push("Theme prices changed");
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
        el("h2", { text: "Minimum app version" }),
        el("p", { class: "sub", text: "Devices older than this are asked to update before they can continue. Leave at 0.0.0 for no limit." }),
        el("div", { class: "field" }, [el("label", { for: "min-v", text: "Version" }), input({ id: "min-v", type: "text", maxlength: "20", placeholder: "0.0.0" }, () => draft.minVersion, (v) => { draft.minVersion = v; })]),
      ]),
      el("div", { class: "card" }, [
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
      el("thead", {}, [el("tr", {}, ["Email", "Sign-in", "Joined", "Last seen", "Status", ""].map((h) => el("th", { text: h })))]),
      el("tbody", {}, rows.map((u) => el("tr", {}, [
        el("td", { class: "mono", text: u.email || "(no email)" }),
        el("td", { text: u.providers.join(", ") || "email" }),
        el("td", { title: when(u.createdAt), text: ago(u.createdAt) }),
        el("td", { title: when(u.lastSignInAt), text: ago(u.lastSignInAt) }),
        el("td", {}, [banned(u) ? el("span", { class: "chip bad", text: "Banned" }) : el("span", { class: "chip " + (u.confirmed ? "ok" : "warn"), text: u.confirmed ? "Active" : "Unconfirmed" })]),
        el("td", {}, [banned(u)
          ? el("button", { class: "btn small", type: "button", text: "Unban", onClick: () => act(u, "user_unban") })
          : el("button", { class: "btn small danger", type: "button", text: "Ban…", onClick: () => ban(u) })]),
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
