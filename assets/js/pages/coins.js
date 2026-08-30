(() => {
  "use strict";

  if (window.__scoutwaveCoinsInstalled) return;
  window.__scoutwaveCoinsInstalled = true;

  const PAGE_ID = "coinsPage";
  const DEFAULT_NAME = "Guest";
  const DEFAULT_BALANCE = 0;

  const SELECTORS = {
    page: "#coinsPage",
    username: "#coinsUsername",
    avatar: "#coinsAvatar",
    balance: "#coinBalance",
    packages: ".coin-package",
    selectedCoins: "#selectedCoins",
    payButton: "#coinsPayBtn"
  };

  const state = {
    page: null,
    user: null,
    profile: null,
    selectedPackage: null,
    loading: false
  };

  let cleanup = null;

  /* -----------------------------------------------------------
   * Helpers
   * --------------------------------------------------------- */

  const getPage = () =>
    document.querySelector(SELECTORS.page);

  const getSupabase = () =>
    window.supabaseClient ||
    window.supabase ||
    null;

  const getAuth = () =>
    window.VerifyAuthStatus || null;

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
      console.error("Coins toast error:", error);
    }
  }

  function navigate(path) {
    if (typeof window.navigate === "function") {
      window.navigate(path);
      return;
    }

    if (typeof window.routerNavigate === "function") {
      window.routerNavigate(path);
      return;
    }

    window.location.href = path;
  }

  /* -----------------------------------------------------------
   * User
   * --------------------------------------------------------- */

  function getUser() {
    const auth = getAuth();

    if (auth?.authenticated && auth.user?.id) {
      return auth.user;
    }

    return null;
  }

  /* -----------------------------------------------------------
   * Header
   * --------------------------------------------------------- */

  function updateUserHeader() {
    const page = state.page;

    if (!page) return;

    const username =
      state.profile?.username ||
      state.user?.user_metadata?.username ||
      DEFAULT_NAME;

    const avatar =
      state.profile?.avatar_url ||
      state.user?.user_metadata?.avatar_url ||
      "";

    const usernameElement =
      page.querySelector(SELECTORS.username);

    const avatarElement =
      page.querySelector(SELECTORS.avatar);

    if (usernameElement) {
      usernameElement.textContent = username;
    }

    if (!avatarElement) return;

    if (avatar) {
      /*
       * Use an image for real profile avatars.
       */
      avatarElement.innerHTML = "";

      const image = document.createElement("img");

      image.src = avatar;
      image.alt = `${username} avatar`;
      image.loading = "lazy";

      image.onerror = () => {
        avatarElement.textContent =
          username.charAt(0).toUpperCase() || "G";
      };

      avatarElement.appendChild(image);
      return;
    }

    avatarElement.textContent =
      username.charAt(0).toUpperCase() || "G";
  }

  /* -----------------------------------------------------------
   * Balance
   * --------------------------------------------------------- */

  function updateBalance(balance) {
    const page = state.page;

    if (!page) return;

    const element =
      page.querySelector(SELECTORS.balance);

    if (!element) return;

    const value = Number(balance);

    element.textContent =
      Number.isFinite(value) && value >= 0
        ? value.toLocaleString()
        : DEFAULT_BALANCE.toLocaleString();
  }

  /* -----------------------------------------------------------
   * Load profile + coins
   * --------------------------------------------------------- */

  async function loadCoins() {
    const supabase = getSupabase();

    if (!supabase) {
      console.error(
        "Scoutwave Coins: Supabase client not found."
      );

      updateBalance(DEFAULT_BALANCE);
      updateUserHeader();

      return;
    }

    const user = getUser();

    /*
     * Guest state.
     */
    if (!user) {
      state.user = null;
      state.profile = null;

      updateUserHeader();
      updateBalance(DEFAULT_BALANCE);

      return;
    }

    state.user = user;

    state.loading = true;

    try {
      /*
       * IMPORTANT:
       *
       * coins_balance is stored directly on
       * public.profiles.
       */
      const {
        data,
        error
      } = await supabase
        .from("profiles")
        .select(
          "id, username, avatar_url, coins_balance"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      state.profile = data || null;

      updateUserHeader();

      updateBalance(
        data?.coins_balance ?? DEFAULT_BALANCE
      );
    } catch (error) {
      console.error(
        "Scoutwave Coins: failed to load balance:",
        error
      );

      state.profile = null;

      updateUserHeader();
      updateBalance(DEFAULT_BALANCE);

      notify(
        "error",
        "Unable to load your coin balance."
      );
    } finally {
      state.loading = false;
    }
  }

  /* -----------------------------------------------------------
   * Package selection
   * --------------------------------------------------------- */

  function selectPackage(button) {
    if (!button) return;

    const page = state.page;

    if (!page) return;

    const coins =
      Number(button.dataset.coins || 0);

    const price =
      Number(button.dataset.price || 0);

    if (!Number.isFinite(coins) || coins <= 0) {
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      return;
    }

    state.selectedPackage = {
      coins,
      price,
      button
    };

    page
      .querySelectorAll(SELECTORS.packages)
      .forEach((packageButton) => {
        const selected =
          packageButton === button;

        packageButton.classList.toggle(
          "is-selected",
          selected
        );

        packageButton.setAttribute(
          "aria-pressed",
          String(selected)
        );
      });

    const selectedCoins =
      page.querySelector(
        SELECTORS.selectedCoins
      );

    if (selectedCoins) {
      selectedCoins.textContent =
        coins.toLocaleString();
    }

    const payButton =
      page.querySelector(
        SELECTORS.payButton
      );

    if (payButton) {
      const priceElement =
        payButton.querySelector("strong");

      if (priceElement) {
        priceElement.textContent =
          `₦${price.toLocaleString()}`;
      }
    }
  }

  /* -----------------------------------------------------------
   * Payment
   * --------------------------------------------------------- */

  function handlePayment() {
    const user = getUser();

    if (!user) {
      notify(
        "error",
        "Please log in to purchase Scoutwave Coins."
      );

      return;
    }

    const selected =
      state.selectedPackage;

    if (!selected) {
      notify(
        "error",
        "Please select a coin package."
      );

      return;
    }

    /*
     * Payment integration can be connected here.
     *
     * Do NOT add coins directly from the browser.
     * Coin crediting should happen server-side
     * after payment verification.
     */
    window.dispatchEvent(
      new CustomEvent(
        "scoutwave:coin-purchase-request",
        {
          detail: {
            user,
            coins: selected.coins,
            price: selected.price
          }
        }
      )
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

    if (
      detail.authenticated &&
      detail.user?.id
    ) {
      await loadCoins();
      return;
    }

    if (detail.authenticated === false) {
      state.user = null;
      state.profile = null;

      updateUserHeader();
      updateBalance(DEFAULT_BALANCE);
    }
  }

  /* -----------------------------------------------------------
   * Events
   * --------------------------------------------------------- */

  function bindEvents(page) {
    const packageButtons =
      page.querySelectorAll(
        SELECTORS.packages
      );

    const payButton =
      page.querySelector(
        SELECTORS.payButton
      );

    const onPackageClick = (event) => {
      const button =
        event.target.closest(
          SELECTORS.packages
        );

      if (!button) return;

      selectPackage(button);
    };

    const onPayClick = () => {
      handlePayment();
    };

    const onAuthChange = (event) => {
      handleAuthChange(event);
    };

    page.addEventListener(
      "click",
      onPackageClick
    );

    payButton?.addEventListener(
      "click",
      onPayClick
    );

    document.addEventListener(
      "scoutwave:auth-state-change",
      onAuthChange
    );

    /*
     * Select the package already marked
     * as selected in the HTML.
     */
    const selected =
      page.querySelector(
        `${SELECTORS.packages}.is-selected`
      );

    if (selected) {
      selectPackage(selected);
    } else if (packageButtons.length) {
      selectPackage(packageButtons[0]);
    }

    return () => {
      page.removeEventListener(
        "click",
        onPackageClick
      );

      payButton?.removeEventListener(
        "click",
        onPayClick
      );

      document.removeEventListener(
        "scoutwave:auth-state-change",
        onAuthChange
      );
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

    if (state.page === page) {
      return;
    }

    cleanup?.();

    state.page = page;
    state.user = null;
    state.profile = null;
    state.selectedPackage = null;

    /*
     * Guest is the initial display state.
     */
    updateUserHeader();
    updateBalance(DEFAULT_BALANCE);

    cleanup = bindEvents(page);

    /*
     * If global authentication has already
     * finished, load immediately.
     */
    const auth = getAuth();

    if (auth?.authenticated) {
      await loadCoins();
    }
  }

  /* -----------------------------------------------------------
   * Public API
   * --------------------------------------------------------- */

  window.CoinsPage = {
    mount,

    refresh() {
      return loadCoins();
    },

    getState() {
      return {
        user: state.user,
        profile: state.profile,
        balance:
          Number(
            state.profile?.coins_balance
          ) || 0,
        selectedPackage:
          state.selectedPackage
            ? {
                coins:
                  state.selectedPackage.coins,
                price:
                  state.selectedPackage.price
              }
            : null
      };
    },

    destroy() {
      cleanup?.();
      cleanup = null;

      state.page = null;
      state.user = null;
      state.profile = null;
      state.selectedPackage = null;
    }
  };

  /*
   * The app-script loader runs this after
   * the SPA page has been inserted.
   */
  mount();

})();