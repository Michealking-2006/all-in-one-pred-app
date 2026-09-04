(() => {
  "use strict";

  if (window.__scoutwaveNotificationsInstalled) return;
  window.__scoutwaveNotificationsInstalled = true;

  const SELECTORS = {
    page: "#notificationsPage",
    content: "#notificationsContent",
    list: "#notificationsList",
    empty: "#notificationsEmpty",
    skeleton: "#notificationsSkeleton",
    markAllBtn: "#notificationsMarkAll",
  };

  const TYPE_LABEL = {
    system: "System",
    prediction: "Prediction",
    coins: "Coins",
    premium: "Premium",
    general: "Update",
  };

  const state = {
    page: null,
    user: null,
    items: [],
    loading: false,
    channel: null,
  };

  let cleanup = null;

  const getPage = () => document.querySelector(SELECTORS.page);

  const getSupabase = () =>
    window.supabaseClient || window.supabase || null;

  const getAuth = () => window.VerifyAuthStatus || null;

  function notify(type, message) {
    if (!message) return;
    try {
      window.toast?.[type]?.(message) || window.toast?.show?.(type, { message });
    } catch (_) {
      /* toast is optional */
    }
  }

  function timeAgo(dateStr) {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";

    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    const units = [
      ["year", 31536000],
      ["month", 2592000],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
    ];

    for (const [label, secs] of units) {
      const value = Math.floor(seconds / secs);
      if (value >= 1) return `${value} ${label}${value > 1 ? "s" : ""} ago`;
    }

    return "just now";
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    }[c]));
  }

  /* -----------------------------------------------------------
   * data
   * --------------------------------------------------------- */

  async function loadNotifications() {
    const client = getSupabase();
    if (!client || !state.user) return [];

    const { data, error } = await client
      .from("notifications")
      .select("id, title, body, type, read, created_at")
      .eq("user_id", state.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[Notifications] load failed:", error);
      return [];
    }

    return data || [];
  }

  async function markRead(id) {
    const client = getSupabase();
    if (!client) return;

    const item = state.items.find((n) => n.id === id);
    if (!item || item.read) return;

    item.read = true;
    renderList();

    const { error } = await client
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    if (error) console.error("[Notifications] mark read failed:", error);
  }

  async function markAllRead() {
    const client = getSupabase();
    if (!client || !state.user) return;

    const unread = state.items.filter((n) => !n.read);
    if (!unread.length) return;

    state.items.forEach((n) => (n.read = true));
    renderList();

    const { error } = await client
      .from("notifications")
      .update({ read: true })
      .eq("user_id", state.user.id)
      .eq("read", false);

    if (error) {
      console.error("[Notifications] mark all read failed:", error);
    } else {
      notify("success", "All notifications marked as read.");
    }
  }

  /* -----------------------------------------------------------
   * render
   * --------------------------------------------------------- */

  function rowHTML(item) {
    const label = TYPE_LABEL[item.type] || TYPE_LABEL.general;

    return `
      <button
        type="button"
        class="notification-row${item.read ? "" : " is-unread"}"
        data-notification-id="${escapeHTML(item.id)}"
      >
        <span class="notification-dot" aria-hidden="true"></span>
        <span class="notification-body">
          <span class="notification-top">
            <span class="notification-type">${escapeHTML(label)}</span>
            <time>${escapeHTML(timeAgo(item.created_at))}</time>
          </span>
          <strong>${escapeHTML(item.title)}</strong>
          ${item.body ? `<span class="notification-text">${escapeHTML(item.body)}</span>` : ""}
        </span>
      </button>
    `;
  }

  function renderList() {
    const page = state.page;
    if (!page) return;

    const list = page.querySelector(SELECTORS.list);
    const empty = page.querySelector(SELECTORS.empty);
    const skeleton = page.querySelector(SELECTORS.skeleton);
    const markAllBtn = page.querySelector(SELECTORS.markAllBtn);

    if (skeleton) skeleton.hidden = true;

    if (list) {
      list.innerHTML = state.items.map(rowHTML).join("");
    }

    if (empty) empty.hidden = state.items.length > 0;

    const hasUnread = state.items.some((n) => !n.read);
    if (markAllBtn) markAllBtn.hidden = !hasUnread;
  }

  /* -----------------------------------------------------------
   * realtime
   * --------------------------------------------------------- */

  function subscribeRealtime() {
    const client = getSupabase();
    if (!client || !state.user || typeof client.channel !== "function") return null;

    return client
      .channel(`notifications:${state.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${state.user.id}`,
        },
        (payload) => {
          state.items = [payload.new, ...state.items];
          renderList();
        }
      )
      .subscribe();
  }

  /* -----------------------------------------------------------
   * lifecycle
   * --------------------------------------------------------- */

  function bindEvents(page) {
    const list = page.querySelector(SELECTORS.list);
    const onListClick = (event) => {
      const row = event.target.closest("[data-notification-id]");
      if (row) markRead(row.getAttribute("data-notification-id"));
    };
    list?.addEventListener("click", onListClick);

    const markAllBtn = page.querySelector(SELECTORS.markAllBtn);
    const onMarkAll = () => markAllRead();
    markAllBtn?.addEventListener("click", onMarkAll);

    return () => {
      list?.removeEventListener("click", onListClick);
      markAllBtn?.removeEventListener("click", onMarkAll);
    };
  }

  async function mount() {
    const page = getPage();
    if (!page) return;

    state.page = page;

    const client = getSupabase();
    const { data: { user } = {} } = client?.auth
      ? await client.auth.getUser().catch(() => ({ data: {} }))
      : {};

    state.user = user || null;

    const unbind = bindEvents(page);

    if (state.user) {
      state.items = await loadNotifications();
      renderList();
      state.channel = subscribeRealtime();
    } else {
      const skeleton = page.querySelector(SELECTORS.skeleton);
      if (skeleton) skeleton.hidden = true;
    }

    cleanup = () => {
      unbind();
      const client2 = getSupabase();
      if (state.channel && client2?.removeChannel) {
        client2.removeChannel(state.channel);
      }
      state.channel = null;
      state.items = [];
      state.page = null;
    };
  }

  function destroy() {
    cleanup?.();
    cleanup = null;
  }

  document.addEventListener("pageLoaded", (event) => {
    if (event.detail?.path === "/notifications") mount();
    else destroy();
  });

  document.addEventListener("pageRefreshed", (event) => {
    if (event.detail?.path === "/notifications") mount();
  });

  if (getPage()) mount();
})();
