// Set html[data-theme] before first paint, straight from localStorage,
// so there is never a flash of the wrong theme. src/theme.js (loaded
// with the app) takes over afterwards for live updates.
(function () {
  try {
    var raw = localStorage.getItem("scoutwave.app.state.v2");
    var pref = "system";
    if (raw) {
      var saved = JSON.parse(raw);
      if (saved && (saved.theme === "light" || saved.theme === "dark" || saved.theme === "system")) pref = saved.theme;
    }
    var dark = pref === "dark" || (pref === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    // Club colours: set the accent right away so there is no flash of red; src/clubTheme.js refines it.
    if (saved && saved.clubTheme && /^#[0-9a-f]{6}$/i.test(saved.clubTheme.primary || "")) document.documentElement.style.setProperty("--accent", saved.clubTheme.primary);
    document.documentElement.dataset.themePref = pref;
    // Lighter mode for low-end phones, decided before first paint (same rules as src/perf.js).
    var nav = navigator, mem = nav.deviceMemory, conn = nav.connection || {};
    var mode = saved && saved.perfMode || "auto";
    var low = mode === "on" || (mode !== "off" && ((typeof mem === "number" && mem <= 2) || (mem == null && nav.hardwareConcurrency <= 4 && /Android/i.test(nav.userAgent)) || conn.saveData === true || conn.effectiveType === "2g" || conn.effectiveType === "slow-2g"));
    if (low) document.documentElement.dataset.lowend = (typeof mem === "number" && mem <= 1 && mode !== "off") ? "2" : "1"; // 2 = 1 GB phones (see src/perf.js)
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
