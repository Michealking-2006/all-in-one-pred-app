(() => {
  "use strict";

  if (window.__scoutwavePremiumInstalled) return;
  window.__scoutwavePremiumInstalled = true;

  const SELECTORS = {
    page: "#premiumPage",
    plans: "[data-premium-plan]",
    plansSection: "#premiumPlansSection",
    ctaSection: "#premiumCtaSection",
    continueBtn: "#premiumContinueBtn",
    activeBanner: "#premiumActiveBanner",
    activeBannerText: "#premiumActiveBannerText",
  };

  const state = {
    page: null,
    user: null,
    selectedPlan: null,
    premiumUntil: null,
  };

  let cleanup = null;

  /* -----------------------------------------------------------
   * Helpers (mirrors assets/js/pages/coins.js)
   * --------------------------------------------------------- */

  const getPage = () => document.querySelector(SELECTORS.page);

  const getSupabase = () =>
    window.supabaseClient || window.supabase || null;

  const getAuth = () => window.VerifyAuthStatus || null;

  function notify(type, message) {
    if (!message) return;

    try {
      const toast =
        window.toastManager ||
        window.ToastManager ||
        window.ToastNotificationsManager ||
        window.toast;

      if (!toast) return;

      if (typeof toast[type] === "function") {
        toast[type](message);
        return;
      }

      if (typeof toast.show === "function") {
        toast.show(message, type);
        return;
      }

      if (typeof toast.notify === "function") {
        toast.notify({ type, message });
      }
    } catch (error) {
      console.error("Premium toast error:", error);
    }
  }

  function getUser() {
    const auth = getAuth();
    if (auth?.authenticated && auth.user?.id) return auth.user;
    return null;
  }

  /* -----------------------------------------------------------
   * Premium status
   * --------------------------------------------------------- */

  async function loadPremiumStatus() {
    const client = getSupabase();
    const user = state.user;
    if (!client || !user) return null;

    const { data, error } = await client
      .from("profiles")
      .select("premium_until")
      .eq("id", user.id)
      .single();

    if (error || !data?.premium_until) return null;

    const until = new Date(data.premium_until);
    return until.getTime() > Date.now() ? until : null;
  }

  function renderPremiumStatus() {
    const page = state.page;
    if (!page) return;

    const banner = page.querySelector(SELECTORS.activeBanner);
    const bannerText = page.querySelector(SELECTORS.activeBannerText);
    const plansSection = page.querySelector(SELECTORS.plansSection);
    const ctaSection = page.querySelector(SELECTORS.ctaSection);

    const isActive = Boolean(state.premiumUntil);

    if (banner) banner.hidden = !isActive;
    if (plansSection) plansSection.hidden = isActive;
    if (ctaSection) ctaSection.hidden = isActive;

    if (isActive && bannerText) {
      bannerText.textContent = `Your plan renews on ${state.premiumUntil.toLocaleDateString(
        undefined,
        { year: "numeric", month: "long", day: "numeric" }
      )}.`;
    }
  }

  /* -----------------------------------------------------------
   * Plan selection
   * --------------------------------------------------------- */

  function selectPlan(button) {
    if (!button) return;

    const page = state.page;
    if (!page) return;

    const plan = button.dataset.plan || "";
    const price = Number(button.dataset.price || 0);

    if (!plan || !Number.isFinite(price) || price < 0) return;

    state.selectedPlan = { plan, price, button };

    page.querySelectorAll(SELECTORS.plans).forEach((planButton) => {
      const selected = planButton === button;
      planButton.classList.toggle("is-selected", selected);
      planButton.setAttribute("aria-pressed", String(selected));
    });

    const continueBtn = page.querySelector(SELECTORS.continueBtn);
    if (continueBtn) {
      continueBtn.dataset.selectedPlan = plan;

      const label = continueBtn.querySelector("[data-selected-plan-label]");
      if (label) {
        label.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
      }
    }
  }

  /* -----------------------------------------------------------
   * Purchase request
   * --------------------------------------------------------- */

  function handleContinue() {
    const user = getUser();

    if (!user) {
      notify("error", "Please log in to go Premium.");
      return;
    }

    const selected = state.selectedPlan;

    if (!selected) {
      notify("error", "Please select a plan.");
      return;
    }

    /*
     * Payment integration can be connected here.
     *
     * Do NOT set premium_until directly from the browser.
     * Activating premium should happen server-side
     * after payment verification, the same way coin
     * purchases are handled.
     */
    window.dispatchEvent(
      new CustomEvent("scoutwave:premium-purchase-request", {
        detail: {
          user,
          plan: selected.plan,
          price: selected.price,
        },
      })
    );
  }

  /* -----------------------------------------------------------
   * Auth changes
   * --------------------------------------------------------- */

  async function handleAuthChange(event) {
    const page = getPage();
    if (!page || page !== state.page) return;

    const detail = event?.detail;
    if (!detail) return;

    if (detail.authenticated && detail.user?.id) {
      state.user = detail.user;
      state.premiumUntil = await loadPremiumStatus();
      renderPremiumStatus();
      return;
    }

    if (detail.authenticated === false) {
      state.user = null;
      state.premiumUntil = null;
      renderPremiumStatus();
    }
  }

  /* -----------------------------------------------------------
   * Events
   * --------------------------------------------------------- */

  function bindEvents(page) {
    const onPlanClick = (event) => {
      const button = event.target.closest(SELECTORS.plans);
      if (!button) return;
      selectPlan(button);
    };

    const continueBtn = page.querySelector(SELECTORS.continueBtn);
    const onContinueClick = () => handleContinue();

    const onAuthChange = (event) => handleAuthChange(event);

    page.addEventListener("click", onPlanClick);
    continueBtn?.addEventListener("click", onContinueClick);
    document.addEventListener("scoutwave:auth-state-change", onAuthChange);

    // select the plan already marked in the html
    const preselected = page.querySelector(`${SELECTORS.plans}.is-selected`);
    const plans = page.querySelectorAll(SELECTORS.plans);

    if (preselected) selectPlan(preselected);
    else if (plans.length) selectPlan(plans[0]);

    return () => {
      page.removeEventListener("click", onPlanClick);
      continueBtn?.removeEventListener("click", onContinueClick);
      document.removeEventListener("scoutwave:auth-state-change", onAuthChange);
    };
  }

  /* -----------------------------------------------------------
   * Mount
   * --------------------------------------------------------- */

  async function mount() {
    const page = getPage();

    if (!page) {
      cleanup?.();
      cleanup = null;
      state.page = null;
      return;
    }

    if (state.page === page) return;

    cleanup?.();

    state.page = page;
    state.user = getUser();
    state.selectedPlan = null;
    state.premiumUntil = null;

    cleanup = bindEvents(page);

    const auth = getAuth();
    if (auth?.authenticated) {
      state.premiumUntil = await loadPremiumStatus();
      renderPremiumStatus();
    }
  }

  window.PremiumPage = {
    mount,
    destroy() {
      cleanup?.();
      cleanup = null;
      state.page = null;
      state.user = null;
      state.selectedPlan = null;
      state.premiumUntil = null;
    },
  };

  mount();
})();
