(() => {
  "use strict";

  /*
   * ============================================================
   * EDIT PROFILE PAGE
   * ============================================================
   *
   * Authentication is handled by:
   *
   *   window.VerifyAuthStatus
   *
   * This page does NOT:
   *   - create an auth manager
   *   - redirect unauthenticated users
   *   - duplicate Supabase auth-state listeners
   *
   * It only asks VerifyAuthStatus for the current auth state.
   *
   * Expected Supabase client:
   *   window.supabaseClient
   *
   * Expected profiles table:
   *   id
   *   username
   *   avatar_url
   *
   * Existing Toast Notifications Manager is used through notify().
   */

  const PAGE_ID = "editProfilePage";

  const DEFAULT_AVATAR =
    "/assets/icons/normal-pfp.jpeg";

  const SELECTORS = {
    page: `#${PAGE_ID}`,
    avatarPreview: "#editProfileAvatarPreview",
    avatarImage: "#editProfileAvatarImage",
    avatarGrid: "#editProfileAvatarGrid",
    username: "#editProfileUsername",
    save: "#editProfileSaveBtn",
    delete: "#editProfileDeleteBtn",
  };

  let mountedPage = null;
  let cleanup = null;

  const state = {
    user: null,
    profile: null,

    selectedAvatar: DEFAULT_AVATAR,

    originalUsername: "",
    originalAvatar: DEFAULT_AVATAR,

    saving: false,
    deleting: false,
  };


  /* ============================================================
   * HELPERS
   * ============================================================ */

  function getPage() {
    return document.querySelector(
      SELECTORS.page
    );
  }

  function getSupabase() {
    return (
      window.supabaseClient ||
      window.supabase ||
      null
    );
  }

  function getAuthManager() {
    return window.VerifyAuthStatus || null;
  }

  function goTo(path) {
    if (typeof window.navigate === "function") {
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
  }

  function escapeUsername(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "");
  }

  function isValidUsername(username) {
    return /^[a-zA-Z0-9._-]{3,30}$/.test(
      username
    );
  }

  function setButtonLoading(
    button,
    loading,
    text
  ) {
    if (!button) return;

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText =
          button.textContent.trim();
      }

      button.disabled = true;
      button.setAttribute(
        "aria-busy",
        "true"
      );

      button.textContent =
        text || "Please wait...";
    } else {
      button.disabled = false;

      button.removeAttribute(
        "aria-busy"
      );

      button.textContent =
        button.dataset.originalText ||
        button.textContent;
    }
  }


  /* ============================================================
   * EXISTING TOAST MANAGER
   * ============================================================ */

  function notify(type, message) {
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
        manager.show(message, type);
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
        "Toast error:",
        error
      );
    }
  }


  /* ============================================================
   * AUTH MANAGER INTEGRATION
   * ============================================================ */

  function configureAuthProtection(
    page
  ) {
    if (!page) return;

    /*
     * Username field.
     */
    const username =
      page.querySelector(
        SELECTORS.username
      );

    if (username) {
    
      username.setAttribute(
        "data-auth-message",
        "Please log in to edit your profile."
      );
    }

    /*
     * Save button.
     */
    const save =
      page.querySelector(
        SELECTORS.save
      );

    if (save) {
      save.setAttribute(
        "data-auth-required",
        "disable"
      );

      save.setAttribute(
        "data-auth-message",
        "Please log in to save your profile."
      );

      save.setAttribute(
        "data-auth-opacity",
        "0.5"
      );
    }

    /*
     * Delete button.
     */
    const deleteButton =
      page.querySelector(
        SELECTORS.delete
      );

    if (deleteButton) {
      deleteButton.setAttribute(
        "data-auth-required",
        "disable"
      );

      deleteButton.setAttribute(
        "data-auth-message",
        "Please log in to delete your account."
      );

      deleteButton.setAttribute(
        "data-auth-opacity",
        "0.5"
      );
    }

    /*
     * Protect avatar choices as well.
     */
    page
      .querySelectorAll(
        `${SELECTORS.avatarGrid} .avatar-option`
      )
      .forEach((button) => {
        button.setAttribute(
          "data-auth-required",
          "disable"
        );

        button.setAttribute(
          "data-auth-message",
          "Please log in to change your avatar."
        );

        button.setAttribute(
          "data-auth-opacity",
          "0.5"
        );
      });

    /*
     * Tell the global manager to immediately
     * process the newly protected elements.
     */
    getAuthManager()?.refresh?.();
  }


  async function requireAuthenticatedUser() {
    const auth =
      getAuthManager();

    if (!auth) {
      console.error(
        "VerifyAuthStatus is not available."
      );

      notify(
        "error",
        "Authentication service is unavailable."
      );

      return null;
    }

    const authenticated =
      await auth.isAuthenticated();

    if (!authenticated) {
      return null;
    }

    const user = auth.user;

    if (!user?.id) {
      return null;
    }

    return user;
  }


  /* ============================================================
   * PROFILE DATA
   * ============================================================ */

  async function loadProfile() {
    const supabase =
      getSupabase();

    if (!supabase) {
      throw new Error(
        "Supabase client unavailable."
      );
    }

    /*
     * Authentication is now handled entirely
     * by VerifyAuthStatus.
     */
    const user =
      await requireAuthenticatedUser();

    /*
     * IMPORTANT:
     * Do not redirect.
     *
     * The auth manager simply protects the page's
     * interactive elements for guest users.
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
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error(
        "Profile load error:",
        error
      );

      throw error;
    }

    state.profile = data || {};

    return state.profile;
  }


  /* ============================================================
   * UI
   * ============================================================ */

  function updateAvatarPreview(
    avatar
  ) {
    const page = getPage();

    if (!page) return;

    const image =
      page.querySelector(
        SELECTORS.avatarImage
      );

    if (image) {
      image.src =
        avatar || DEFAULT_AVATAR;
    }
  }


  function updateAvatarSelection() {
    const page = getPage();

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


  function populateProfile() {
    const page = getPage();

    if (!page) return;

    const usernameInput =
      page.querySelector(
        SELECTORS.username
      );

    const username =
      state.profile?.username ||
      state.user?.user_metadata
        ?.username ||
      "";

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

    if (usernameInput) {
      usernameInput.value =
        username;
    }

    updateAvatarPreview(
      avatar
    );

    updateAvatarSelection();
  }


  function clearProfileState() {
    state.user = null;
    state.profile = null;

    state.selectedAvatar =
      DEFAULT_AVATAR;

    state.originalUsername = "";

    state.originalAvatar =
      DEFAULT_AVATAR;

    const page = getPage();

    if (!page) return;

    const usernameInput =
      page.querySelector(
        SELECTORS.username
      );

    if (usernameInput) {
      usernameInput.value = "";
    }

    updateAvatarPreview(
      DEFAULT_AVATAR
    );

    updateAvatarSelection();
  }


  /* ============================================================
   * AVATAR SELECTION
   * ============================================================ */

  function handleAvatarClick(
    event
  ) {
    const button =
      event.target.closest(
        ".avatar-option"
      );

    if (!button) return;

    const page = getPage();

    if (!page?.contains(button)) {
      return;
    }

    /*
     * Let the global auth manager be
     * the source of truth.
     */
    const auth =
      getAuthManager();

    if (
      auth &&
      !auth.authenticated
    ) {
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

    const page = getPage();
    const supabase =
      getSupabase();

    if (!page || !supabase) {
      return;
    }

    /*
     * Final authentication check.
     *
     * The global manager already disables
     * the button for guests, but this check
     * protects against programmatic calls.
     */
    const user =
      await requireAuthenticatedUser();

    if (!user) {
      notify(
        "error",
        "Please log in to save your profile."
      );

      return;
    }

    state.user = user;

    const usernameInput =
      page.querySelector(
        SELECTORS.username
      );

    const saveButton =
      page.querySelector(
        SELECTORS.save
      );

    const username =
      escapeUsername(
        usernameInput?.value
      );

    if (!username) {
      notify(
        "error",
        "Please enter a username."
      );

      usernameInput?.focus();
      return;
    }

    if (!isValidUsername(username)) {
      notify(
        "error",
        "Username must be 3–30 characters and can only contain letters, numbers, dots, underscores, or hyphens."
      );

      usernameInput?.focus();

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
      saveButton,
      true,
      "Saving..."
    );

    try {
      /*
       * Check whether another profile
       * already owns this username.
       */
      if (
        username.toLowerCase() !==
        state.originalUsername.toLowerCase()
      ) {
        const {
          data:
            existingProfile,
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

      /*
       * Save profile.
       */
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
        .eq("id", user.id)
        .select(
          "id, username, avatar_url"
        )
        .single();

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

      /*
       * Keep auth metadata synchronized.
       *
       * This is supplementary only. The
       * profiles table remains the source
       * for the editable profile data.
       */
      if (
        supabase.auth?.updateUser
      ) {
        try {
          await supabase.auth.updateUser(
            {
              data: {
                username,
                avatar_url:
                  state.selectedAvatar,
              },
            }
          );
        } catch (metadataError) {
          console.warn(
            "Auth metadata update failed:",
            metadataError
          );
        }
      }

      /*
       * Notify the rest of Scoutwave.
       */
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

      setTimeout(() => {
        if (getPage()) {
          goTo("/profile");
        }
      }, 350);
    } catch (error) {
      console.error(
        "Save profile error:",
        error
      );

      notify(
        "error",
        "Something went wrong while saving your profile."
      );
    } finally {
      state.saving = false;

      setButtonLoading(
        saveButton,
        false
      );
    }
  }


  /* ============================================================
   * DELETE ACCOUNT
   * ============================================================ */

  async function deleteAccount() {
    if (state.deleting) return;

    const page = getPage();
    const supabase =
      getSupabase();

    if (!page || !supabase) {
      return;
    }

    /*
     * Final authentication verification.
     */
    const user =
      await requireAuthenticatedUser();

    if (!user) {
      notify(
        "error",
        "Please log in to delete your account."
      );

      return;
    }

    state.user = user;

    const deleteButton =
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
      deleteButton,
      true,
      "Deleting..."
    );

    try {
      /*
       * Account deletion must be performed
       * server-side.
       */
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
       * End current session.
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
        "Delete account error:",
        error
      );

      notify(
        "error",
        "Something went wrong while deleting your account."
      );
    } finally {
      state.deleting = false;

      setButtonLoading(
        deleteButton,
        false
      );
    }
  }


  /* ============================================================
   * AUTH STATE CHANGE
   * ============================================================ */

  async function handleAuthStateChange(
    event
  ) {
    const detail =
      event?.detail;

    if (!detail) return;

    const page = getPage();

    if (!page) return;

    if (
      detail.authenticated &&
      detail.user?.id
    ) {
      /*
       * User just logged in while
       * this page was mounted.
       */
      try {
        const profile =
          await loadProfile();

        if (
          getPage() !== page ||
          !profile
        ) {
          return;
        }

        populateProfile();
      } catch (error) {
        console.error(
          "Profile reload after auth:",
          error
        );
      }

      return;
    }

    /*
     * User logged out.
     *
     * Do not redirect.
     * VerifyAuthStatus will protect
     * the interactive elements.
     */
    if (
      detail.state ===
        "unauthenticated" ||
      detail.authenticated === false
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
        handleAuthStateChange(
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
    const page = getPage();

    /*
     * Page disappeared.
     */
    if (!page) {
      cleanup?.();
      cleanup = null;
      mountedPage = null;
      return;
    }

    /*
     * Already mounted on the same DOM node.
     */
    if (
      mountedPage === page
    ) {
      return;
    }

    cleanup?.();
    cleanup = null;

    mountedPage = page;

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
     * Give VerifyAuthStatus control
     * over all protected elements.
     */
    configureAuthProtection(
      page
    );

    cleanup =
      bindEvents(page);

    try {
      const profile =
        await loadProfile();

      /*
       * Navigation may have changed
       * while Supabase was loading.
       */
      if (
        getPage() !== page
      ) {
        return;
      }

      /*
       * Guest:
       *
       * Keep the page available.
       * VerifyAuthStatus has already
       * disabled the protected controls.
       */
      if (!profile) {
        return;
      }

      populateProfile();
    } catch (error) {
      console.error(
        "Edit profile initialization error:",
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
   * SPA OBSERVER
   * ============================================================ */

  let observer = null;
  let mountQueued = false;

  function queueMount() {
    if (mountQueued) return;

    mountQueued = true;

    queueMicrotask(() => {
      mountQueued = false;
      mount();
    });
  }

  function start() {
    queueMount();

    if (observer) {
      return;
    }

    observer =
      new MutationObserver(() => {
        queueMount();
      });

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true,
      }
    );
  }


  /* ============================================================
   * GLOBAL API
   * ============================================================ */

  window.EditProfilePage = {
    mount,

    destroy() {
      cleanup?.();

      cleanup = null;
      mountedPage = null;

      observer?.disconnect();
      observer = null;
    },

    getState() {
      return {
        ...state,
      };
    },
  };


  /* ============================================================
   * START
   * ============================================================ */

  start();
})();