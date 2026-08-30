(() => {
  "use strict";

  /*
   * ============================================================
   * SCOUTWAVE — EDIT PROFILE
   * ============================================================
   *
   * Global dependencies:
   *   window.VerifyAuthStatus
   *   window.supabaseClient
   *
   * This page only handles profile functionality.
   * Authentication UI is controlled globally.
   * ============================================================
   */

  const PAGE_ID = "editProfilePage";
  const DEFAULT_AVATAR = "/assets/icons/normal-pfp.jpeg";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  let page = null;
  let removeEvents = null;

  const state = {
    user: null,
    profile: null,
    avatar: DEFAULT_AVATAR,
    originalUsername: "",
    originalAvatar: DEFAULT_AVATAR,
    saving: false,
    deleting: false,
  };


  /* ============================================================
   * GLOBALS
   * ============================================================ */

  function supabase() {
    return (
      window.supabaseClient ||
      window.supabase ||
      null
    );
  }

  function auth() {
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
      } else if (typeof manager.show === "function") {
        manager.show(message, type);
      } else if (typeof manager.notify === "function") {
        manager.notify({ type, message });
      }
    } catch (error) {
      console.error("Toast error:", error);
    }
  }


  /* ============================================================
   * ROUTER
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
   * AUTHENTICATED USER
   * ============================================================ */

  async function getUser() {
    const manager = auth();

    if (manager?.authenticated && manager.user?.id) {
      return manager.user;
    }

    /*
     * Auth manager is global, but this fallback prevents
     * the page from becoming completely dependent on script
     * execution timing.
     */
    const client = supabase();

    if (!client?.auth?.getUser) {
      return null;
    }

    const { data, error } =
      await client.auth.getUser();

    if (error) {
      return null;
    }

    return data?.user || null;
  }


  /* ============================================================
   * PROFILE
   * ============================================================ */

  async function loadProfile() {
    const client = supabase();
    const user = await getUser();

    state.user = user;
    state.profile = null;

    if (!client || !user?.id) {
      clearForm();
      return false;
    }

    const { data, error } = await client
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    state.profile = data || {};

    const username =
      String(
        state.profile.username ||
          user.user_metadata?.username ||
          ""
      ).trim();

    const avatar =
      state.profile.avatar_url ||
      user.user_metadata?.avatar_url ||
      DEFAULT_AVATAR;

    state.originalUsername = username;
    state.originalAvatar = avatar;
    state.avatar = avatar;

    const input = $(SELECTORS.username, page);

    if (input) {
      input.value = username;
    }

    setAvatar(avatar);

    return true;
  }


  /* ============================================================
   * UI SELECTORS
   * ============================================================ */

  const SELECTORS = {
    page: `#${PAGE_ID}`,
    image: "#editProfileAvatarImage",
    grid: "#editProfileAvatarGrid",
    username: "#editProfileUsername",
    save: "#editProfileSaveBtn",
    delete: "#editProfileDeleteBtn",
  };


  /* ============================================================
   * AVATAR
   * ============================================================ */

  function setAvatar(avatar) {
    state.avatar = avatar || DEFAULT_AVATAR;

    const image = $(SELECTORS.image, page);

    if (image) {
      image.src = state.avatar;
    }

    $$(".avatar-option", page).forEach((button) => {
      const selected =
        (button.dataset.avatar || DEFAULT_AVATAR) ===
        state.avatar;

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


  function handleAvatarClick(event) {
    const button = event.target.closest(
      ".avatar-option"
    );

    if (!button || !page?.contains(button)) {
      return;
    }

    /*
     * VerifyAuthStatus already locks guest
     * controls. This is only a logical guard.
     */
    if (!auth()?.authenticated) {
      toast(
        "error",
        "Please log in to change your avatar."
      );
      return;
    }

    const avatar = button.dataset.avatar;

    if (avatar) {
      setAvatar(avatar);
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


  function validUsername(username) {
    return /^[A-Za-z0-9._-]{3,30}$/.test(username);
  }


  /* ============================================================
   * FORM STATE
   * ============================================================ */

  function clearForm() {
    state.user = null;
    state.profile = null;
    state.avatar = DEFAULT_AVATAR;
    state.originalUsername = "";
    state.originalAvatar = DEFAULT_AVATAR;

    const input = $(SELECTORS.username, page);

    if (input) {
      input.value = "";
    }

    setAvatar(DEFAULT_AVATAR);
  }


  function setLoading(button, loading, text) {
    if (!button) return;

    if (loading) {
      button.dataset.originalText ??=
        button.textContent.trim();

      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = text;
      return;
    }

    button.removeAttribute("aria-busy");
    button.textContent =
      button.dataset.originalText ||
      button.textContent;

    /*
     * Let VerifyAuthStatus decide whether the
     * control should remain disabled.
     */
    if (auth()?.authenticated) {
      button.disabled = false;
    }
  }


  /* ============================================================
   * SAVE
   * ============================================================ */

  async function saveProfile() {
    if (state.saving) return;

    const client = supabase();

    if (!client || !page) {
      return;
    }

    const user = await getUser();

    if (!user?.id) {
      toast(
        "error",
        "Please log in to save your profile."
      );
      return;
    }

    const input = $(SELECTORS.username, page);
    const button = $(SELECTORS.save, page);

    const username =
      normalizeUsername(input?.value);

    if (!username) {
      toast(
        "error",
        "Please enter a username."
      );
      input?.focus();
      return;
    }

    if (!validUsername(username)) {
      toast(
        "error",
        "Username must be 3–30 characters and can only contain letters, numbers, dots, underscores, or hyphens."
      );
      input?.focus();
      return;
    }

    if (
      username === state.originalUsername &&
      state.avatar === state.originalAvatar
    ) {
      toast(
        "info",
        "No changes were made."
      );
      return;
    }

    state.saving = true;
    setLoading(button, true, "Saving...");

    try {
      /*
       * Only check uniqueness when the username changed.
       */
      if (
        username.toLowerCase() !==
        state.originalUsername.toLowerCase()
      ) {
        const { data: existing, error } =
          await client
            .from("profiles")
            .select("id")
            .ilike("username", username)
            .neq("id", user.id)
            .limit(1)
            .maybeSingle();

        if (error) {
          throw error;
        }

        if (existing) {
          toast(
            "error",
            "That username is already taken."
          );
          return;
        }
      }

      const { data, error } =
        await client
          .from("profiles")
          .update({
            username,
            avatar_url: state.avatar,
          })
          .eq("id", user.id)
          .select("id, username, avatar_url")
          .maybeSingle();

      if (error) {
        if (
          error.code === "23505" ||
          /username/i.test(error.message || "")
        ) {
          toast(
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
          avatar_url: state.avatar,
        };

      state.originalUsername = username;
      state.originalAvatar = state.avatar;

      /*
       * Keep auth metadata synchronized,
       * but don't make profile saving depend on it.
       */
      try {
        if (client.auth?.updateUser) {
          await client.auth.updateUser({
            data: {
              username,
              avatar_url: state.avatar,
            },
          });
        }
      } catch (error) {
        console.warn(
          "Auth metadata update failed:",
          error
        );
      }

      window.dispatchEvent(
        new CustomEvent("profile:updated", {
          detail: {
            user,
            profile: state.profile,
          },
        })
      );

      toast(
        "success",
        "Profile updated successfully."
      );

      setTimeout(() => {
        if (page === $(SELECTORS.page)) {
          navigate("/profile");
        }
      }, 350);
    } catch (error) {
      console.error(
        "Edit profile save error:",
        error
      );

      toast(
        "error",
        "Something went wrong while saving your profile."
      );
    } finally {
      state.saving = false;
      setLoading(button, false);
    }
  }


  /* ============================================================
   * DELETE
   * ============================================================ */

  async function deleteAccount() {
    if (state.deleting) return;

    const client = supabase();

    if (!client || !page) {
      return;
    }

    const user = await getUser();

    if (!user?.id) {
      toast(
        "error",
        "Please log in to delete your account."
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete your Scoutwave account?\n\nThis action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    const button = $(SELECTORS.delete, page);

    state.deleting = true;
    setLoading(button, true, "Deleting...");

    try {
      const { error } =
        await client.rpc(
          "delete_user_account"
        );

      if (error) {
        console.error(
          "Delete account error:",
          error
        );

        toast(
          "error",
          "Account deletion is currently unavailable."
        );

        return;
      }

      await client.auth.signOut();

      clearForm();

      toast(
        "success",
        "Your account has been deleted."
      );

      setTimeout(() => {
        navigate("/");
      }, 500);
    } catch (error) {
      console.error(
        "Delete account error:",
        error
      );

      toast(
        "error",
        "Something went wrong while deleting your account."
      );
    } finally {
      state.deleting = false;
      setLoading(button, false);
    }
  }


  /* ============================================================
   * AUTH CHANGE
   * ============================================================ */

  async function handleAuthChange(event) {
    const detail = event?.detail;

    if (!detail || page !== $(SELECTORS.page)) {
      return;
    }

    if (detail.authenticated && detail.user?.id) {
      try {
        await loadProfile();

        if (page !== $(SELECTORS.page)) {
          return;
        }

        auth()?.refresh?.();
      } catch (error) {
        console.error(
          "Edit profile auth reload error:",
          error
        );
      }

      return;
    }

    if (detail.authenticated === false) {
      clearForm();
    }
  }


  /* ============================================================
   * EVENTS
   * ============================================================ */

  function bindEvents() {
    if (!page) return;

    const grid = $(SELECTORS.grid, page);
    const save = $(SELECTORS.save, page);
    const deleteButton = $(SELECTORS.delete, page);

    const onAvatar = (event) =>
      handleAvatarClick(event);

    const onSave = () =>
      saveProfile();

    const onDelete = () =>
      deleteAccount();

    const onAuth = (event) =>
      handleAuthChange(event);

    grid?.addEventListener(
      "click",
      onAvatar
    );

    save?.addEventListener(
      "click",
      onSave
    );

    deleteButton?.addEventListener(
      "click",
      onDelete
    );

    document.addEventListener(
      "scoutwave:auth-state-change",
      onAuth
    );

    removeEvents = () => {
      grid?.removeEventListener(
        "click",
        onAvatar
      );

      save?.removeEventListener(
        "click",
        onSave
      );

      deleteButton?.removeEventListener(
        "click",
        onDelete
      );

      document.removeEventListener(
        "scoutwave:auth-state-change",
        onAuth
      );
    };
  }


  /* ============================================================
   * MOUNT
   * ============================================================ */

  async function mount() {
    const nextPage = $(SELECTORS.page);

    if (!nextPage) {
      destroy();
      return;
    }

    if (page === nextPage) {
      return;
    }

    removeEvents?.();

    page = nextPage;

    state.user = null;
    state.profile = null;
    state.avatar = DEFAULT_AVATAR;
    state.originalUsername = "";
    state.originalAvatar = DEFAULT_AVATAR;
    state.saving = false;
    state.deleting = false;

    bindEvents();

    /*
     * The global auth manager owns the UI state.
     */
    auth()?.refresh?.();

    /*
     * Guests stay on the page with protected
     * controls locked by VerifyAuthStatus.
     */
    if (!auth()?.authenticated) {
      return;
    }

    try {
      await loadProfile();

      if (page !== $(SELECTORS.page)) {
        return;
      }

      auth()?.refresh?.();
    } catch (error) {
      console.error(
        "Edit profile load error:",
        error
      );

      toast(
        "error",
        "Unable to load your profile."
      );
    }
  }


  /* ============================================================
   * DESTROY
   * ============================================================ */

  function destroy() {
    removeEvents?.();

    removeEvents = null;
    page = null;

    state.user = null;
    state.profile = null;
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
        avatar: state.avatar,
        originalUsername:
          state.originalUsername,
        originalAvatar:
          state.originalAvatar,
        saving: state.saving,
        deleting: state.deleting,
      };
    },
  };


  /* ============================================================
   * SPA-SAFE START
   * ============================================================ */

  /*
   * Critical for your custom <app-script> loader:
   *
   * If this script has already been evaluated before,
   * execute mount() again instead of returning.
   */
  mount();

})();