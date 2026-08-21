(() => {
  "use strict";

  /*
   * ============================================================
   * EDIT PROFILE PAGE
   * ============================================================
   *
   * Expected Supabase client:
   *   window.supabaseClient
   *
   * Expected profiles table:
   *   id
   *   username
   *   avatar_url
   *
   * Existing toast manager:
   *   This file does NOT create a toast manager.
   *   notify() only attempts to call the existing manager.
   */

  const PAGE_ID = "editProfilePage";

  let mountedPage = null;
  let cleanup = null;

  const DEFAULT_AVATAR = "/assets/icons/normal-pfp.jpeg";

  const SELECTORS = {
    page: `#${PAGE_ID}`,
    avatarPreview: "#editProfileAvatarPreview",
    avatarImage: "#editProfileAvatarImage",
    avatarGrid: "#editProfileAvatarGrid",
    username: "#editProfileUsername",
    save: "#editProfileSaveBtn",
    delete: "#editProfileDeleteBtn",
  };

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
    return document.querySelector(SELECTORS.page);
  }

  function getSupabase() {
    return window.supabaseClient || window.supabase || null;
  }

  function getCurrentUser() {
    if (typeof window.getCurrentUser === "function") {
      return window.getCurrentUser();
    }

    return null;
  }

  function goTo(path) {
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

  function escapeUsername(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "");
  }

  function isValidUsername(username) {
    return /^[a-zA-Z0-9._-]{3,30}$/.test(username);
  }

  function setButtonLoading(button, loading, text) {
    if (!button) return;

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent.trim();
      }

      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = text || "Please wait...";
    } else {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent =
        button.dataset.originalText || button.textContent;
    }
  }


  /* ============================================================
   * EXISTING TOAST MANAGER ADAPTER
   * ============================================================ */

  function notify(type, message) {
    /*
     * Do not create a toast system here.
     *
     * Supports several common interfaces so the existing
     * Toast Notifications Manager can be used without changing it.
     */

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

        return;
      }
    } catch (error) {
      console.error("Toast error:", error);
    }
  }


  /* ============================================================
   * PROFILE DATA
   * ============================================================ */

  async function getUser() {
    const helperUser = getCurrentUser();

    if (helperUser && typeof helperUser.then === "function") {
      return await helperUser;
    }

    if (helperUser) {
      return helperUser;
    }

    const supabase = getSupabase();

    if (!supabase?.auth?.getUser) {
      return null;
    }

    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error("Unable to get authenticated user:", error);
      return null;
    }

    return data?.user || null;
  }


  async function loadProfile() {
    const supabase = getSupabase();

    if (!supabase) {
      throw new Error("Authentication service unavailable.");
    }

    const user = await getUser();

    if (!user?.id) {
      goTo("/login");
      return null;
    }

    state.user = user;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Profile load error:", error);
      throw error;
    }

    state.profile = data || {};

    return state.profile;
  }


  /* ============================================================
   * UI
   * ============================================================ */

  function updateAvatarPreview(avatar) {
    const page = getPage();

    if (!page) return;

    const preview = page.querySelector(SELECTORS.avatarImage);

    if (preview) {
      preview.src = avatar || DEFAULT_AVATAR;
    }
  }


  function updateAvatarSelection() {
    const page = getPage();

    if (!page) return;

    page
      .querySelectorAll(`${SELECTORS.avatarGrid} .avatar-option`)
      .forEach((button) => {
        const avatar = button.dataset.avatar || DEFAULT_AVATAR;
        const selected = avatar === state.selectedAvatar;

        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
  }


  function populateProfile() {
    const page = getPage();

    if (!page) return;

    const usernameInput = page.querySelector(SELECTORS.username);

    const username =
      state.profile?.username ||
      state.user?.user_metadata?.username ||
      "";

    const avatar =
      state.profile?.avatar_url ||
      state.user?.user_metadata?.avatar_url ||
      DEFAULT_AVATAR;

    state.originalUsername = username;
    state.originalAvatar = avatar;
    state.selectedAvatar = avatar;

    if (usernameInput) {
      usernameInput.value = username;
    }

    updateAvatarPreview(avatar);
    updateAvatarSelection();
  }


  /* ============================================================
   * AVATAR SELECTION
   * ============================================================ */

  function handleAvatarClick(event) {
    const button = event.target.closest(".avatar-option");

    if (!button) return;

    const page = getPage();

    if (!page?.contains(button)) return;

    const avatar = button.dataset.avatar;

    if (!avatar) return;

    state.selectedAvatar = avatar;

    updateAvatarPreview(avatar);
    updateAvatarSelection();
  }


  /* ============================================================
   * SAVE PROFILE
   * ============================================================ */

  async function saveProfile() {
    if (state.saving) return;

    const page = getPage();
    const supabase = getSupabase();

    if (!page || !supabase || !state.user?.id) return;

    const usernameInput = page.querySelector(SELECTORS.username);
    const saveButton = page.querySelector(SELECTORS.save);

    const username = escapeUsername(usernameInput?.value);

    if (!username) {
      notify("error", "Please enter a username.");
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
      username === state.originalUsername &&
      state.selectedAvatar === state.originalAvatar;

    if (unchanged) {
      notify("info", "No changes were made.");
      return;
    }

    state.saving = true;

    setButtonLoading(saveButton, true, "Saving...");

    try {
      /*
       * Check whether another user already owns the username.
       * This avoids relying entirely on a database constraint error.
       */

      if (username.toLowerCase() !== state.originalUsername.toLowerCase()) {
        const { data: existingProfile, error: usernameCheckError } =
          await supabase
            .from("profiles")
            .select("id")
            .ilike("username", username)
            .neq("id", state.user.id)
            .limit(1)
            .maybeSingle();

        if (usernameCheckError) {
          throw usernameCheckError;
        }

        if (existingProfile) {
          notify("error", "That username is already taken.");
          return;
        }
      }


      const { data, error } = await supabase
        .from("profiles")
        .update({
          username,
          avatar_url: state.selectedAvatar,
        })
        .eq("id", state.user.id)
        .select("id, username, avatar_url")
        .single();

      if (error) {
        /*
         * PostgreSQL unique constraint fallback.
         */
        if (
          error.code === "23505" ||
          /username/i.test(error.message || "")
        ) {
          notify("error", "That username is already taken.");
          return;
        }

        throw error;
      }

      state.profile = data || {
        id: state.user.id,
        username,
        avatar_url: state.selectedAvatar,
      };

      state.originalUsername = username;
      state.originalAvatar = state.selectedAvatar;

      /*
       * Keep auth metadata in sync where possible.
       * Failure here should not undo a successfully saved profile.
       */
      if (supabase.auth?.updateUser) {
        try {
          await supabase.auth.updateUser({
            data: {
              username,
              avatar_url: state.selectedAvatar,
            },
          });
        } catch (metadataError) {
          console.warn(
            "Auth metadata update failed:",
            metadataError
          );
        }
      }

      /*
       * Let the rest of the SPA know profile data changed.
       */
      window.dispatchEvent(
        new CustomEvent("profile:updated", {
          detail: {
            user: state.user,
            profile: state.profile,
          },
        })
      );

      notify("success", "Profile updated successfully.");

      /*
       * Return to profile after saving.
       */
      setTimeout(() => {
        if (getPage()) {
          goTo("/profile");
        }
      }, 350);
    } catch (error) {
      console.error("Save profile error:", error);

      notify(
        "error",
        "Something went wrong while saving your profile."
      );
    } finally {
      state.saving = false;
      setButtonLoading(saveButton, false);
    }
  }


  /* ============================================================
   * DELETE ACCOUNT
   * ============================================================ */

  async function deleteAccount() {
    if (state.deleting) return;

    const page = getPage();
    const supabase = getSupabase();

    if (!page || !supabase || !state.user?.id) return;

    const deleteButton = page.querySelector(SELECTORS.delete);

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete your Scoutwave account?\n\nThis action cannot be undone."
    );

    if (!confirmed) return;

    state.deleting = true;

    setButtonLoading(deleteButton, true, "Deleting...");

    try {
      /*
       * IMPORTANT:
       * Supabase Auth users cannot be permanently deleted safely
       * from the browser using auth.admin.deleteUser().
       *
       * This calls a server-side RPC that should perform the
       * account deletion.
       */

      const { error } = await supabase.rpc(
        "delete_user_account"
      );

      if (error) {
        console.error("Delete account RPC error:", error);

        notify(
          "error",
          "Account deletion is currently unavailable."
        );

        return;
      }

      /*
       * End the current session after successful deletion.
       */
      if (supabase.auth?.signOut) {
        await supabase.auth.signOut();
      }

      notify("success", "Your account has been deleted.");

      setTimeout(() => {
        goTo("/");
      }, 500);
    } catch (error) {
      console.error("Delete account error:", error);

      notify(
        "error",
        "Something went wrong while deleting your account."
      );
    } finally {
      state.deleting = false;
      setButtonLoading(deleteButton, false);
    }
  }


  /* ============================================================
   * EVENTS
   * ============================================================ */

  function bindEvents(page) {
    const avatarGrid = page.querySelector(SELECTORS.avatarGrid);
    const saveButton = page.querySelector(SELECTORS.save);
    const deleteButton = page.querySelector(SELECTORS.delete);

    const onAvatarClick = (event) => {
      handleAvatarClick(event);
    };

    const onSaveClick = () => {
      saveProfile();
    };

    const onDeleteClick = () => {
      deleteAccount();
    };

    avatarGrid?.addEventListener("click", onAvatarClick);
    saveButton?.addEventListener("click", onSaveClick);
    deleteButton?.addEventListener("click", onDeleteClick);

    return () => {
      avatarGrid?.removeEventListener("click", onAvatarClick);
      saveButton?.removeEventListener("click", onSaveClick);
      deleteButton?.removeEventListener("click", onDeleteClick);
    };
  }


  /* ============================================================
   * MOUNT
   * ============================================================ */

  async function mount() {
    const page = getPage();

    /*
     * Page is not currently mounted.
     * Clean up the previous instance.
     */
    if (!page) {
      cleanup?.();
      cleanup = null;
      mountedPage = null;
      return;
    }

    /*
     * Same DOM instance — do not mount twice.
     */
    if (mountedPage === page) {
      return;
    }

    cleanup?.();
    cleanup = null;

    mountedPage = page;

    /*
     * Reset state for this mount.
     */
    state.user = null;
    state.profile = null;
    state.selectedAvatar = DEFAULT_AVATAR;
    state.originalUsername = "";
    state.originalAvatar = DEFAULT_AVATAR;
    state.saving = false;
    state.deleting = false;

    cleanup = bindEvents(page);

    try {
      const profile = await loadProfile();

      /*
       * Route may have changed while the async request was running.
       */
      if (getPage() !== page) {
        return;
      }

      if (!profile) return;

      populateProfile();
    } catch (error) {
      console.error("Edit profile initialization error:", error);

      if (getPage() === page) {
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

    if (observer) return;

    observer = new MutationObserver(() => {
      queueMount();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
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
  };

  start();
})();