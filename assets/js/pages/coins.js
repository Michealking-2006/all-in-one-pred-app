(() => {
  "use strict";

  /*
   * ============================================================
   * SCOUTWAVE — COINS PAGE
   * ============================================================
   *
   * Global dependencies:
   *
   *   window.supabaseClient
   *   window.VerifyAuthStatus
   *
   * Expected profiles columns:
   *
   *   username
   *   avatar_url
   *   coins
   *
   * Guest defaults:
   *
   *   username: Guest
   *   avatar: M
   *   coins: 0
   * ============================================================
   */

  const PAGE_ID = "coinsPage";
  const DEFAULT_NAME = "Guest";
  const DEFAULT_AVATAR = "/assets/icons/normal-pfp.jpeg";

  const SELECTORS = {
    page: `#${PAGE_ID}`,
    avatar: "#coinsAvatar",
    username: "#coinsUsername",
    balance: "#coinBalance",
    packages: ".coin-package",
    selectedCoins: "#selectedCoins",
    pay: "#coinsPayBtn",
  };

  let page = null;
  let cleanup = null;

  const state = {
    user: null,
    profile: null,

    balance: 0,

    selectedCoins: 8,
    selectedPrice: 430,
  };


  /* ============================================================
   * GLOBAL SERVICES
   * ============================================================ */

  function getSupabase() {
    return (
      window.supabaseClient ||
      window.supabase ||
      null
    );
  }

  function getAuth() {
    return window.VerifyAuthStatus || null;
  }


  /* ============================================================
   * TOAST
   * ============================================================ */

  function toast(type, message) {
    const manager =
      window.toastManager ||
      window.ToastManager ||
      window.ToastNotificationsManager ||
      window.toast;

    if (!manager) {
      console.warn(message);
      return;
    }

    try {
      if (typeof manager[type] === "function") {
        manager[type](message);
        return;
      }

      if (typeof manager.show === "function") {
        manager.show(message, type);
        return;
      }

      if (typeof manager.notify === "function") {
        manager.notify({
          type,
          message,
        });
      }
    } catch (error) {
      console.error("Coins toast error:", error);
    }
  }


  /* ============================================================
   * NAVIGATION
   * ============================================================ */

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


  /* ============================================================
   * FORMATTERS
   * ============================================================ */

  function formatNumber(value) {
    return new Intl.NumberFormat("en-NG").format(
      Number(value) || 0
    );
  }

  function formatPrice(value) {
    return `₦${formatNumber(value)}`;
  }


  /* ============================================================
   * USER
   * ============================================================ */

  function getUser() {
    const auth = getAuth();

    if (
      auth?.authenticated &&
      auth.user?.id
    ) {
      return auth.user;
    }

    return null;
  }


  /* ============================================================
   * PROFILE
   * ============================================================ */

  async function loadProfile() {
    const client = getSupabase();
    const user = getUser();

    state.user = user;
    state.profile = null;
    state.balance = 0;

    if (!client || !user?.id) {
      renderGuest();
      return;
    }

    const {
      data,
      error,
    } = await client
      .from("profiles")
      .select(
        "username, avatar_url, coins"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    state.profile = data || {};
    state.balance =
      Number(data?.coins) || 0;

    renderUser();
  }


  /* ============================================================
   * HEADER / BALANCE
   * ============================================================ */

  function setAvatarDisplay(avatarUrl, username) {
    const avatar = $(SELECTORS.avatar);

    if (!avatar) return;

    const fallback =
      String(username || DEFAULT_NAME)
        .trim()
        .charAt(0)
        .toUpperCase() || "G";

    /*
     * Keep the avatar element lightweight:
     * use the real image when available,
     * otherwise show the user's initial.
     */
    if (avatarUrl) {
      avatar.textContent = "";

      const image =
        document.createElement("img");

      image.src = avatarUrl;
      image.alt = "";
      image.loading = "lazy";

      image.addEventListener(
        "error",
        () => {
          image.remove();
          avatar.textContent = fallback;
        },
        { once: true }
      );

      avatar.appendChild(image);
      return;
    }

    avatar.textContent = fallback;
  }


  function renderGuest() {
    const username = $(SELECTORS.username);
    const balance = $(SELECTORS.balance);

    if (username) {
      username.textContent = DEFAULT_NAME;
    }

    if (balance) {
      balance.textContent = formatNumber(0);
    }

    setAvatarDisplay(
      null,
      DEFAULT_NAME
    );
  }


  function renderUser() {
    const username = $(SELECTORS.username);
    const balance = $(SELECTORS.balance);

    const name =
      String(
        state.profile?.username ||
        state.user?.user_metadata?.username ||
        DEFAULT_NAME
      ).trim() || DEFAULT_NAME;

    if (username) {
      username.textContent = name;
    }

    if (balance) {
      balance.textContent =
        formatNumber(state.balance);
    }

    setAvatarDisplay(
      state.profile?.avatar_url ||
        state.user?.user_metadata?.avatar_url ||
        null,
      name
    );
  }


  /* ============================================================
   * PACKAGE SELECTION
   * ============================================================ */

  function getPackages() {
    return $$(SELECTORS.packages);
  }

  function selectPackage(button) {
    if (!button) return;

    const coins =
      Number(button.dataset.coins);

    const price =
      Number(button.dataset.price);

    if (
      !Number.isFinite(coins) ||
      !Number.isFinite(price)
    ) {
      return;
    }

    state.selectedCoins = coins;
    state.selectedPrice = price;

    getPackages().forEach((item) => {
      const selected =
        item === button;

      item.classList.toggle(
        "is-selected",
        selected
      );

      item.setAttribute(
        "aria-pressed",
        String(selected)
      );
    });

    renderSelection();
  }


  function renderSelection() {
    const selectedCoins =
      $(SELECTORS.selectedCoins);

    const payButton =
      $(SELECTORS.pay);

    if (selectedCoins) {
      selectedCoins.textContent =
        formatNumber(
          state.selectedCoins
        );
    }

    if (payButton) {
      const price =
        payButton.querySelector("strong");

      if (price) {
        price.textContent =
          formatPrice(
            state.selectedPrice
          );
      }
    }
  }


  function selectInitialPackage() {
    const first =
      getPackages().find(
        (button) =>
          button.classList.contains(
            "is-selected"
          )
      ) || getPackages()[0];

    if (!first) return;

    selectPackage(first);
  }


  /* ============================================================
   * PAYMENT
   * ============================================================ */

  async function continueToPayment() {
    const auth = getAuth();

    if (!auth?.authenticated) {
      toast(
        "error",
        "Please log in to purchase Scoutwave Coins."
      );
      return;
    }

    if (!state.user?.id) {
      toast(
        "error",
        "Please log in to continue."
      );
      return;
    }

    const packageData = {
      coins: state.selectedCoins,
      price: state.selectedPrice,
      currency: "NGN",
    };

    /*
     * Payment provider integration goes here.
     *
     * We intentionally don't fake a successful
     * purchase or modify the user's coin balance
     * from the browser.
     */
    window.dispatchEvent(
      new CustomEvent(
        "coins:purchase-request",
        {
          detail: {
            user: state.user,
            package: packageData,
          },
        }
      )
    );

    toast(
      "info",
      "Payment is not connected yet."
    );
  }


  /* ============================================================
   * EVENTS
   * ============================================================ */

  function bindEvents() {
    if (!page) return;

    const grid =
      $(SELECTORS.page, document);

    const pay =
      $(SELECTORS.pay, page);

    const onPackageClick =
      (event) => {
        const button =
          event.target.closest(
            ".coin-package"
          );

        if (
          !button ||
          !page.contains(button)
        ) {
          return;
        }

        selectPackage(button);
      };

    const onPay =
      () => {
        continueToPayment();
      };

    const onAuthChange =
      async (event) => {
        if (
          page !== $(SELECTORS.page)
        ) {
          return;
        }

        if (
          event?.detail?.authenticated
        ) {
          try {
            await loadProfile();
          } catch (error) {
            console.error(
              "Coins profile reload error:",
              error
            );

            toast(
              "error",
              "Unable to load your coin balance."
            );
          }

          return;
        }

        state.user = null;
        state.profile = null;
        state.balance = 0;

        renderGuest();
      };

    grid?.addEventListener(
      "click",
      onPackageClick
    );

    pay?.addEventListener(
      "click",
      onPay
    );

    document.addEventListener(
      "scoutwave:auth-state-change",
      onAuthChange
    );

    cleanup = () => {
      grid?.removeEventListener(
        "click",
        onPackageClick
      );

      pay?.removeEventListener(
        "click",
        onPay
      );

      document.removeEventListener(
        "scoutwave:auth-state-change",
        onAuthChange
      );
    };
  }


  /* ============================================================
   * PAGE MOUNT
   * ============================================================ */

  async function mount() {
    const nextPage =
      $(SELECTORS.page);

    if (!nextPage) {
      destroy();
      return;
    }

    if (page === nextPage) {
      return;
    }

    cleanup?.();

    page = nextPage;

    state.user = null;
    state.profile = null;
    state.balance = 0;
    state.selectedCoins = 8;
    state.selectedPrice = 430;

    /*
     * Guest state renders immediately.
     * This prevents empty UI while Supabase
     * is being checked.
     */
    renderGuest();

    selectInitialPackage();
    bindEvents();

    /*
     * Global auth manager controls auth state.
     */
    const auth = getAuth();

    if (!auth?.authenticated) {
      return;
    }

    try {
      await loadProfile();

      if (
        page !== $(SELECTORS.page)
      ) {
        return;
      }

      auth.refresh?.();
    } catch (error) {
      console.error(
        "Coins page load error:",
        error
      );

      toast(
        "error",
        "Unable to load your coin balance."
      );
    }
  }


  /* ============================================================
   * DESTROY
   * ============================================================ */

  function destroy() {
    cleanup?.();

    cleanup = null;
    page = null;

    state.user = null;
    state.profile = null;
    state.balance = 0;
  }


  /* ============================================================
   * PUBLIC API
   * ============================================================ */

  window.CoinsPage = {
    mount,
    destroy,

    getState() {
      return {
        user: state.user,
        profile: state.profile,
        balance: state.balance,
        selectedCoins:
          state.selectedCoins,
        selectedPrice:
          state.selectedPrice,
      };
    },
  };


  /* ============================================================
   * START
   * ============================================================ */

  mount();

})();