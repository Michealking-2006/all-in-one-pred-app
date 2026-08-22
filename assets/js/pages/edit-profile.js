(() => {
  "use strict";

  /*
   * ============================================================
   * SCOUTWAVE — EDIT PROFILE PAGE
   * ============================================================
   *
   * Global authentication:
   *   window.VerifyAuthStatus
   *
   * Global toast manager:
   *   window.toastManager / ToastManager / toast
   *
   * Responsibilities of this file:
   *   - Load the current user's profile
   *   - Display username/avatar
   *   - Change avatar
   *   - Validate username
   *   - Save profile
   *   - Delete account
   *   - React to global auth changes
   *
   * This file does NOT:
   *   - create an auth system
   *   - create auth listeners for Supabase
   *   - redirect guests
   *   - control auth opacity/disabled styles
   *
   * VerifyAuthStatus owns those responsibilities.
   * ============================================================
   */


  /* ============================================================
   * INSTALL GUARD
   * ============================================================ */

  if (window.__scoutwaveEditProfileInstalled) {
    return;
  }

  window.__scoutwaveEditProfileInstalled = true;


  /* ============================================================
   * CONFIG
   * ============================================================ */

  const PAGE_ID = "editProfilePage";

  const DEFAULT_AVATAR =
    "/assets/icons/normal-pfp.jpeg";

  const SELECTORS = {
    page: `#${PAGE_ID}`,
    avatarImage: "#editProfileAvatarImage",
    avatarGrid: "#editProfileAvatarGrid",
    username: "#editProfileUsername",
    save: "#editProfileSaveBtn",
    delete: "#editProfileDeleteBtn",
  };


  /* ============================================================
   * STATE
   * ============================================================ */

  const state = {
    page: null,

    user: null,
    profile: null,

    selectedAvatar: DEFAULT_AVATAR,

    originalUsername: "",
    originalAvatar: DEFAULT_AVATAR,

    saving: false,
    deleting: false,

    mounted: false,
    authReadyHandler: null,
    authChangeHandler: null,
  };


  /* ============================================================
   * DOM
   * ============================================================ */

  function getPage() {
    return document.querySelector(
      SELECTORS.page
    );
  }


  /* ============================================================
   * SUPABASE
   * ============================================================ */

  function getSupabase() {
    return (
      window.supabaseClient ||
      window.supabase ||
      null
    );
  }


  /* ============================================================
   * GLOBAL AUTH MANAGER
   * ============================================================ */

  function getAuthManager() {
    return window.VerifyAuthStatus || null;
  }


  async function getAuthenticatedUser() {
    const auth = getAuthManager();

    if (!auth) {
      return null;
    }

    try {
      /*
       * VerifyAuthStatus is the source of truth.
       */
      if (!auth.authenticated) {
        return null;
      }

      const user = auth.user;

      if (!user?.id) {
        return null;
      }

      return user;
    } catch (error) {
      console.error(
        "Edit Profile auth check failed:",
        error
      );

      return null;
    }
  }


  /* ============================================================
   * TOAST
   * ============================================================ */

  function notify(type, message) {
    if (!message) return;

    try {
      const manager =
        window.toastManager ||
        window.ToastManager ||
        window.ToastNotificationsManager ||
        window.toast;

      if (!manager) {
        console.warn(message);
        return;
      }

      if (
        typeof manager[type] ===
        "function"
      ) {
        manager[type](message);
        return;
      }

      if (
        typeof manager.show ===
        "function"
      ) {
        manager.show(
          message,
          type
        );
        return;
      }

      if (
        typeof manager.notify ===
        "function"
      ) {
        manager.notify({
          type,
          message,
        });
      }
    } catch (error) {
      console.error(
        "Edit Profile toast error:",
        error
      );
    }
  }


  /* ============================================================
   * NAVIGATION
   * ============================================================ */

  function goTo(path) {
    try {
      if (
        typeof window.navigate ===
        "function"
      ) {
        window.navigate(path);
        return;
      }

      if (
        typeof window.routerNavigate ===
        "function"
      ) {
        window.routerNavigate(path);
        return;
      }

      window.location.href = path;
    } catch (error) {
      console.error(
        "Edit Profile navigation error:",
        error
      );

      window.location.href = path;
    }
  }


  /* ============================================================
   * USERNAME
   * ============================================================ */

  function normalizeUsername(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "");
  }


  function isValidUsername(username) {
    return /^[A-Za-z0-9._-]{3,30}$/.test(
      username
    );
  }


  /* ============================================================
   * BUTTON LOADING
   * ============================================================ */

  function setButtonLoading(
    button,
    loading,
    loadingText
  ) {
    if (!button) return;

    if (loading) {
      if (
        !button.dataset.originalText
      ) {
        button.dataset.originalText =
          button.textContent.trim();
      }

      button.disabled = true;

      button.setAttribute(
        "aria-busy",
        "true"
      );

      button.textContent =
        loadingText ||
        "Please wait...";

      return;
    }

    button.removeAttribute(
      "aria-busy"
    );

    /*
     * Do NOT blindly set disabled=false.
     *
     * VerifyAuthStatus may currently have
     * the button disabled because the user
     * is logged out.
     */
    const auth =
      getAuthManager();

    const authenticated =
      Boolean(
        auth?.authenticated
      );

    if (authenticated) {
      button.disabled = false;
    }

    button.textContent =
      button.dataset.originalText ||
      button.textContent;
  }


  /* ============================================================
   * PROFILE LOAD
   * ============================================================ */

  async function loadProfile() {
    const supabase =
      getSupabase();

    if (!supabase) {
      throw new Error(
        "Supabase client is unavailable."
      );
    }

    const user =
      await getAuthenticatedUser();

    /*
     * Guest users can stay on the page.
     * The global auth manager handles the
     * locked UI.
     */
    if (!user) {
      state.user = null;
      state.profile = null;

      return null;
    }

    state.user = user;

    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .select(
        "id, username, avatar_url"
      )
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

    if (error) {
      console.error(
        "Edit Profile profile query error:",
        error
      );

      throw error;
    }

    state.profile =
      data || {};

    return state.profile;
  }


  /* ============================================================
   * AVATAR PREVIEW
   * ============================================================ */

  function updateAvatarPreview(
    avatar
  ) {
    const page = state.page;

    if (!page) return;

    const image =
      page.querySelector(
        SELECTORS.avatarImage
      );

    if (!image) return;

    const nextAvatar =
      avatar || DEFAULT_AVATAR;

    if (
      image.getAttribute("src") !==
      nextAvatar
    ) {
      image.src = nextAvatar;
    }
  }


  /* ============================================================
   * AVATAR SELECTION
   * ============================================================ */

  function updateAvatarSelection() {
    const page = state.page;

    if (!page) return;

    page
      .querySelectorAll(
        `${SELECTORS.avatarGrid} .avatar-option`
      )
      .forEach((button) => {
        const avatar =
          button.dataset.avatar ||
          DEFAULT_AVATAR;

        const selected =
          avatar ===
          state.selectedAvatar;

        button.classList.toggle(
          "is-selected",
          selected
        );

        button.setAttribute(
          "aria-pressed",
          String(selected)
        );
      });
  }


  /* ============================================================
   * POPULATE UI
   * ============================================================ */

  function populateProfile() {
    const page = state.page;

    if (!page) return;

    const input =
      page.querySelector(
        SELECTORS.username
      );

    const username =
      String(
        state.profile?.username ||
          state.user?.user_metadata
            ?.username ||
          ""
      ).trim();

    const avatar =
      state.profile?.avatar_url ||
      state.user?.user_metadata
        ?.avatar_url ||
      DEFAULT_AVATAR;

    state.originalUsername =
      username;

    state.originalAvatar =
      avatar;

    state.selectedAvatar =
      avatar;

    if (input) {
      input.value = username;
    }

    updateAvatarPreview(
      avatar
    );

    updateAvatarSelection();
  }


  /* ============================================================
   * CLEAR PROFILE
   * ============================================================ */

  function clearProfileState() {
    state.user = null;
    state.profile = null;

    state.selectedAvatar =
      DEFAULT_AVATAR;

    state.originalUsername = "";

    state.originalAvatar =
      DEFAULT_AVATAR;

    const page = state.page;

    if (!page) return;

    const input =
      page.querySelector(
        SELECTORS.username
      );

    if (input) {
      input.value = "";
    }

    updateAvatarPreview(
      DEFAULT_AVATAR
    );

    updateAvatarSelection();
  }


  /* ============================================================
   * AVATAR CLICK
   * ============================================================ */

  function handleAvatarClick(event) {
    const button =
      event.target.closest(
        ".avatar-option"
      );

    if (!button) return;

    const page = state.page;

    if (!page?.contains(button)) {
      return;
    }

    const auth =
      getAuthManager();

    /*
     * The auth manager should already have
     * disabled this button for guests.
     *
     * This second check protects against
     * programmatic calls.
     */
    if (!auth?.authenticated) {
      notify(
        "error",
        "Please log in to change your avatar."
      );

      return;
    }

    const avatar =
      button.dataset.avatar;

    if (!avatar) return;

    state.selectedAvatar =
      avatar;

    updateAvatarPreview(
      avatar
    );

    updateAvatarSelection();
  }


  /* ============================================================
   * SAVE PROFILE
   * ============================================================ */

  async function saveProfile() {
    if (state.saving) return;

    const page = state.page;
    const supabase =
      getSupabase();

    if (!page || !supabase) {
      return;
    }

    const user =
      await getAuthenticatedUser();

    if (!user) {
      notify(
        "error",
        "Please log in to save your profile."
      );

      return;
    }

    state.user = user;

    const input =
      page.querySelector(
        SELECTORS.username
      );

    const button =
      page.querySelector(
        SELECTORS.save
      );

    const username =
      normalizeUsername(
        input?.value
      );

    if (!username) {
      notify(
        "error",
        "Please enter a username."
      );

      input?.focus();

      return;
    }

    if (!isValidUsername(username)) {
      notify(
        "error",
        "Username must be 3–30 characters and can only contain letters, numbers, dots, underscores, or hyphens."
      );

      input?.focus();

      return;
    }

    const unchanged =
      username ===
        state.originalUsername &&
      state.selectedAvatar ===
        state.originalAvatar;

    if (unchanged) {
      notify(
        "info",
        "No changes were made."
      );

      return;
    }

    state.saving = true;

    setButtonLoading(
      button,
      true,
      "Saving..."
    );

    try {
      /*
       * Check username availability when
       * the username has actually changed.
       */
      if (
        username.toLowerCase() !==
        state.originalUsername.toLowerCase()
      ) {
        const {
          data: existingProfile,
          error:
            usernameCheckError,
        } = await supabase
          .from("profiles")
          .select("id")
          .ilike(
            "username",
            username
          )
          .neq(
            "id",
            user.id
          )
          .limit(1)
          .maybeSingle();

        if (usernameCheckError) {
          throw usernameCheckError;
        }

        if (existingProfile) {
          notify(
            "error",
            "That username is already taken."
          );

          return;
        }
      }


      /* --------------------------------------------------------
       * UPDATE PROFILE
       * -------------------------------------------------------- */

      const {
        data,
        error,
      } = await supabase
        .from("profiles")
        .update({
          username,
          avatar_url:
            state.selectedAvatar,
        })
        .eq(
          "id",
          user.id
        )
        .select(
          "id, username, avatar_url"
        )
        .maybeSingle();

      if (error) {
        if (
          error.code === "23505" ||
          /username/i.test(
            error.message || ""
          )
        ) {
          notify(
            "error",
            "That username is already taken."
          );

          return;
        }

        throw error;
      }

      /*
       * If RLS allows UPDATE but does not
       * return the updated row, still keep
       * our local state correct.
       */
      state.profile =
        data || {
          id: user.id,
          username,
          avatar_url:
            state.selectedAvatar,
        };

      state.originalUsername =
        username;

      state.originalAvatar =
        state.selectedAvatar;


      /* --------------------------------------------------------
       * OPTIONAL AUTH METADATA SYNC
       * -------------------------------------------------------- */

      if (
        supabase.auth?.updateUser
      ) {
        try {
          await supabase.auth.updateUser({
            data: {
              username,
              avatar_url:
                state.selectedAvatar,
            },
          });
        } catch (error) {
          /*
           * Profile update succeeded.
           * Metadata is supplementary.
           */
          console.warn(
            "Edit Profile auth metadata update failed:",
            error
          );
        }
      }


      /* --------------------------------------------------------
       * APP EVENT
       * -------------------------------------------------------- */

      window.dispatchEvent(
        new CustomEvent(
          "profile:updated",
          {
            detail: {
              user,
              profile:
                state.profile,
            },
          }
        )
      );


      notify(
        "success",
        "Profile updated successfully."
      );


      /*
       * Give the toast a moment to appear
       * before SPA navigation.
       */
      setTimeout(() => {
        if (
          state.page &&
          getPage() === state.page
        ) {
          goTo("/profile");
        }
      }, 350);
    } catch (error) {
      console.error(
        "Edit Profile save error:",
        error
      );

      notify(
        "error",
        "Something went wrong while saving your profile."
      );
    } finally {
      state.saving = false;

      setButtonLoading(
        button,
        false
      );
    }
  }


  /* ============================================================
   * DELETE ACCOUNT
   * ============================================================ */

  async function deleteAccount() {
    if (state.deleting) return;

    const page = state.page;
    const supabase =
      getSupabase();

    if (!page || !supabase) {
      return;
    }

    const user =
      await getAuthenticatedUser();

    if (!user) {
      notify(
        "error",
        "Please log in to delete your account."
      );

      return;
    }

    state.user = user;

    const button =
      page.querySelector(
        SELECTORS.delete
      );

    const confirmed =
      window.confirm(
        "Are you sure you want to permanently delete your Scoutwave account?\n\nThis action cannot be undone."
      );

    if (!confirmed) {
      return;
    }

    state.deleting = true;

    setButtonLoading(
      button,
      true,
      "Deleting..."
    );

    try {
      const {
        error,
      } = await supabase.rpc(
        "delete_user_account"
      );

      if (error) {
        console.error(
          "Delete account RPC error:",
          error
        );

        notify(
          "error",
          "Account deletion is currently unavailable."
        );

        return;
      }

      /*
       * Sign out after the server-side
       * deletion succeeds.
       */
      if (
        supabase.auth?.signOut
      ) {
        await supabase.auth.signOut();
      }

      clearProfileState();

      notify(
        "success",
        "Your account has been deleted."
      );

      setTimeout(() => {
        goTo("/");
      }, 500);
    } catch (error) {
      console.error(
        "Edit Profile account deletion error:",
        error
      );

      notify(
        "error",
        "Something went wrong while deleting your account."
      );
    } finally {
      state.deleting = false;

      setButtonLoading(
        button,
        false
      );
    }
  }


  /* ============================================================
   * GLOBAL AUTH EVENT
   * ============================================================ */

  async function handleAuthChange(event) {
    const detail =
      event?.detail;

    if (!detail) return;

    const page =
      getPage();

    if (
      !page ||
      page !== state.page
    ) {
      return;
    }


    /* ----------------------------------------------------------
     * USER SIGNED IN
     * ---------------------------------------------------------- */

    if (
      detail.authenticated &&
      detail.user?.id
    ) {
      try {
        const profile =
          await loadProfile();

        /*
         * Route changed while loading.
         */
        if (
          getPage() !== page
        ) {
          return;
        }

        if (profile) {
          populateProfile();
        }

        /*
         * Ask the global manager to resync
         * the page controls.
         */
        getAuthManager()
          ?.refresh?.();
      } catch (error) {
        console.error(
          "Edit Profile auth reload error:",
          error
        );
      }

      return;
    }


    /* ----------------------------------------------------------
     * USER SIGNED OUT
     * ---------------------------------------------------------- */

    if (
      detail.authenticated ===
      false
    ) {
      clearProfileState();
    }
  }


  /* ============================================================
   * EVENTS
   * ============================================================ */

  function bindEvents(page) {
    const avatarGrid =
      page.querySelector(
        SELECTORS.avatarGrid
      );

    const saveButton =
      page.querySelector(
        SELECTORS.save
      );

    const deleteButton =
      page.querySelector(
        SELECTORS.delete
      );


    const onAvatarClick =
      (event) => {
        handleAvatarClick(
          event
        );
      };

    const onSaveClick =
      () => {
        saveProfile();
      };

    const onDeleteClick =
      () => {
        deleteAccount();
      };

    const onAuthChange =
      (event) => {
        handleAuthChange(
          event
        );
      };


    avatarGrid?.addEventListener(
      "click",
      onAvatarClick
    );

    saveButton?.addEventListener(
      "click",
      onSaveClick
    );

    deleteButton?.addEventListener(
      "click",
      onDeleteClick
    );

    document.addEventListener(
      "scoutwave:auth-state-change",
      onAuthChange
    );


    return () => {
      avatarGrid?.removeEventListener(
        "click",
        onAvatarClick
      );

      saveButton?.removeEventListener(
        "click",
        onSaveClick
      );

      deleteButton?.removeEventListener(
        "click",
        onDeleteClick
      );

      document.removeEventListener(
        "scoutwave:auth-state-change",
        onAuthChange
      );
    };
  }


  /* ============================================================
   * MOUNT
   * ============================================================ */

  async function mount() {
    const page =
      getPage();

    /*
     * Page isn't currently mounted.
     */
    if (!page) {
      if (state.mounted) {
        destroy();
      }

      return;
    }

    /*
     * Same DOM node.
     */
    if (
      state.mounted &&
      state.page === page
    ) {
      return;
    }


    /*
     * Clean previous mount.
     */
    cleanup?.();

    cleanup = null;


    /*
     * Establish current page.
     */
    state.page = page;
    state.mounted = true;


    /*
     * Reset local state.
     */
    state.user = null;
    state.profile = null;

    state.selectedAvatar =
      DEFAULT_AVATAR;

    state.originalUsername = "";

    state.originalAvatar =
      DEFAULT_AVATAR;

    state.saving = false;
    state.deleting = false;


    /*
     * Bind immediately.
     */
    cleanup =
      bindEvents(page);


    /*
     * VerifyAuthStatus is global.
     *
     * It should already exist. We don't
     * load it or create it here.
     */
    const auth =
      getAuthManager();


    /*
     * Auth manager isn't available yet.
     *
     * Wait for its global ready event
     * instead of creating a second auth
     * implementation.
     */
    if (!auth) {
      state.authReadyHandler =
        () => {
          state.authReadyHandler = null;

          if (
            getPage() === page
          ) {
            mount();
          }
        };

      document.addEventListener(
        "scoutwave:auth-ready",
        state.authReadyHandler,
        {
          once: true,
        }
      );

      return;
    }


    /*
     * Auth manager may still be checking.
     *
     * Wait for its ready event if the
     * state isn't resolved yet.
     */
    if (
      auth.state === "checking"
    ) {
      state.authReadyHandler =
        () => {
          state.authReadyHandler = null;

          if (
            getPage() === page
          ) {
            mount();
          }
        };

      document.addEventListener(
        "scoutwave:auth-ready",
        state.authReadyHandler,
        {
          once: true,
        }
      );

      return;
    }


    /*
     * Make sure data-auth-required
     * elements are synchronized.
     */
    auth.refresh?.();


    /*
     * Guest:
     *
     * The page remains accessible.
     * VerifyAuthStatus has already locked
     * the protected elements.
     */
    if (!auth.authenticated) {
      return;
    }


    /*
     * Authenticated user:
     * load their profile.
     */
    try {
      const profile =
        await loadProfile();

      /*
       * User navigated away while the
       * network request was running.
       */
      if (
        getPage() !== page
      ) {
        return;
      }

      if (profile) {
        populateProfile();
      }
    } catch (error) {
      console.error(
        "Edit Profile initialization error:",
        error
      );

      if (
        getPage() === page
      ) {
        notify(
          "error",
          "Unable to load your profile."
        );
      }
    }
  }


  /* ============================================================
   * DESTROY
   * ============================================================ */

  function destroy() {
    if (
      state.authReadyHandler
    ) {
      document.removeEventListener(
        "scoutwave:auth-ready",
        state.authReadyHandler
      );

      state.authReadyHandler =
        null;
    }

    cleanup?.();

    cleanup = null;

    state.page = null;
    state.mounted = false;

    state.user = null;
    state.profile = null;

    state.saving = false;
    state.deleting = false;
  }


  /* ============================================================
   * PUBLIC API
   * ============================================================ */

  window.EditProfilePage = {
    mount,
    destroy,

    getState() {
      return {
        user: state.user,
        profile: state.profile,
        selectedAvatar:
          state.selectedAvatar,
        originalUsername:
          state.originalUsername,
        originalAvatar:
          state.originalAvatar,
        saving: state.saving,
        deleting: state.deleting,
        mounted: state.mounted,
      };
    },
  };


  /* ============================================================
   * START
   * ============================================================ */

  /*
   * Your <app-script> loader should execute this
   * after the page HTML has been mounted.
   */
  mount();

})();