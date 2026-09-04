(() => {
  "use strict";

  if (window.__scoutwaveVipTipsInstalled) return;
  window.__scoutwaveVipTipsInstalled = true;

  const SELECTORS = {
    page: "#vipTipsPage",
    list: "#vipTipsList",
    empty: "#vipTipsEmpty",
    skeleton: "#vipTipsSkeleton",
    upsell: "#vipTipsUpsell",
  };

  const state = {
    page: null,
    user: null,
    isPremium: false,
  };

  let cleanup = null;

  const getPage = () => document.querySelector(SELECTORS.page);

  const getSupabase = () =>
    window.supabaseClient || window.supabase || null;

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    }[c]));
  }

  function formatKickoff(dateStr) {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /* -----------------------------------------------------------
   * premium status
   * --------------------------------------------------------- */

  async function loadPremiumStatus() {
    const client = getSupabase();
    if (!client || !state.user) return false;

    const { data, error } = await client
      .from("profiles")
      .select("premium_until")
      .eq("id", state.user.id)
      .single();

    if (error || !data?.premium_until) return false;

    return new Date(data.premium_until).getTime() > Date.now();
  }

  /* -----------------------------------------------------------
   * tips
   * --------------------------------------------------------- */

  async function loadTips() {
    const client = getSupabase();
    if (!client) return [];

    const { data, error } = await client
      .from("vip_tips")
      .select("id, league, match_label, market, pick, confidence, kickoff_at")
      .gte("kickoff_at", new Date().toISOString())
      .order("kickoff_at", { ascending: true })
      .limit(30);

    if (error) {
      console.error("[VipTips] load failed:", error);
      return [];
    }

    return data || [];
  }

  function tipCardHTML(tip) {
    return `
      <article class="vip-tip-card">
        <div class="vip-tip-top">
          <span class="vip-tip-league">${escapeHTML(tip.league || "")}</span>
          <time>${escapeHTML(formatKickoff(tip.kickoff_at))}</time>
        </div>
        <strong class="vip-tip-match">${escapeHTML(tip.match_label || "")}</strong>
        <div class="vip-tip-pick">
          <span>${escapeHTML(tip.market || "")}</span>
          <strong>${escapeHTML(tip.pick || "")}</strong>
        </div>
        ${
          tip.confidence != null
            ? `<div class="vip-tip-confidence">
                <div class="vip-tip-confidence-bar" style="width:${Math.max(0, Math.min(100, Number(tip.confidence)))}%"></div>
              </div>
              <span class="vip-tip-confidence-label">${escapeHTML(tip.confidence)}% confidence</span>`
            : ""
        }
      </article>
    `;
  }

  /* -----------------------------------------------------------
   * render
   * --------------------------------------------------------- */

  function setVisible(el, visible) {
    if (el) el.hidden = !visible;
  }

  async function renderForUser(page) {
    const list = page.querySelector(SELECTORS.list);
    const empty = page.querySelector(SELECTORS.empty);
    const skeleton = page.querySelector(SELECTORS.skeleton);
    const upsell = page.querySelector(SELECTORS.upsell);

    if (!state.isPremium) {
      setVisible(skeleton, false);
      setVisible(list, false);
      setVisible(empty, false);
      setVisible(upsell, true);
      return;
    }

    setVisible(upsell, false);

    const tips = await loadTips();

    setVisible(skeleton, false);

    if (list) list.innerHTML = tips.map(tipCardHTML).join("");
    setVisible(list, tips.length > 0);
    setVisible(empty, tips.length === 0);
  }

  /* -----------------------------------------------------------
   * lifecycle
   * --------------------------------------------------------- */

  async function mount() {
    const page = getPage();
    if (!page) return;

    state.page = page;

    const client = getSupabase();
    const { data: { user } = {} } = client?.auth
      ? await client.auth.getUser().catch(() => ({ data: {} }))
      : {};

    state.user = user || null;

    if (state.user) {
      state.isPremium = await loadPremiumStatus();
      await renderForUser(page);
    } else {
      const skeleton = page.querySelector(SELECTORS.skeleton);
      setVisible(skeleton, false);
    }

    cleanup = () => {
      state.page = null;
      state.user = null;
      state.isPremium = false;
    };
  }

  function destroy() {
    cleanup?.();
    cleanup = null;
  }

  document.addEventListener("pageLoaded", (event) => {
    if (event.detail?.path === "/vip-tips") mount();
    else destroy();
  });

  document.addEventListener("pageRefreshed", (event) => {
    if (event.detail?.path === "/vip-tips") mount();
  });

  if (getPage()) mount();
})();
