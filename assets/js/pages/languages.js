(() => {
  "use strict";

  if (window.__scoutwaveLanguagesInstalled) return;
  window.__scoutwaveLanguagesInstalled = true;

  const STORAGE_KEY = "scoutwave_language";

  const SELECTORS = {
    page: "#languagePage",
    options: "[data-language]",
  };

  let cleanup = null;

  const getPage = () => document.querySelector(SELECTORS.page);
  const getSupabase = () => window.supabaseClient || window.supabase || null;
  const getAuth = () => window.VerifyAuthStatus || null;

  /* -----------------------------------------------------------
   * shared helpers — also used by profile.js to render the
   * currently-selected language next to the menu item
   * --------------------------------------------------------- */

  function getSavedLanguage() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "en";
    } catch {
      return "en";
    }
  }

  function saveLanguage(code) {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* localStorage unavailable — preference just won't persist */
    }
  }

  window.ScoutwaveLanguage = {
    get: getSavedLanguage,
  };

  /* -----------------------------------------------------------
   * sync to profile (best-effort, non-blocking — the language
   * column is optional; failures here shouldn't disrupt the UI)
   * --------------------------------------------------------- */

  async function syncToProfile(code) {
    const client = getSupabase();
    const auth = getAuth();
    if (!client || !auth?.authenticated || !auth.user?.id) return;

    try {
      await client
        .from("profiles")
        .update({ language: code })
        .eq("id", auth.user.id);
    } catch (error) {
      console.error("[Languages] profile sync failed:", error);
    }
  }

  /* -----------------------------------------------------------
   * render
   * --------------------------------------------------------- */

  function applySelection(page, code) {
    page.querySelectorAll(SELECTORS.options).forEach((btn) => {
      const selected = btn.getAttribute("data-language") === code;
      btn.classList.toggle("is-selected", selected);
      btn.setAttribute("aria-pressed", String(selected));
    });
  }

  function selectLanguage(page, button) {
    const code = button.getAttribute("data-language");
    const name = button.getAttribute("data-language-name") || code;
    if (!code) return;

    saveLanguage(code);
    applySelection(page, code);
    syncToProfile(code);

    document.dispatchEvent(
      new CustomEvent("scoutwave:language-changed", { detail: { code, name } })
    );
  }

  /* -----------------------------------------------------------
   * lifecycle
   * --------------------------------------------------------- */

  function bindEvents(page) {
    const onClick = (event) => {
      const button = event.target.closest(SELECTORS.options);
      if (button) selectLanguage(page, button);
    };

    page.addEventListener("click", onClick);
    return () => page.removeEventListener("click", onClick);
  }

  function mount() {
    const page = getPage();
    if (!page) return;

    applySelection(page, getSavedLanguage());

    cleanup?.();
    cleanup = bindEvents(page);
  }

  function destroy() {
    cleanup?.();
    cleanup = null;
  }

  document.addEventListener("pageLoaded", (event) => {
    if (event.detail?.path === "/profile/languages") mount();
    else destroy();
  });

  document.addEventListener("pageRefreshed", (event) => {
    if (event.detail?.path === "/profile/languages") mount();
  });

  if (getPage()) mount();
})();
