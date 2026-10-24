// Web fonts (DM Sans) load after the page has finished loading instead of blocking the first paint, and are skipped on
// 1 GB phones and when data saver is on (the system font is used instead: the font stack in theme.css falls back to it).
// An external file, not inline, because the page's Content-Security-Policy forbids inline scripts.
(function () {
  try {
    if (document.documentElement.dataset.lowend === "2") return;
    if (navigator.connection && navigator.connection.saveData) return;
  } catch (e) { /* unknown: load them */ }
  function add() {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }
  if (document.readyState === "complete") add();
  else window.addEventListener("load", add, { once: true });
})();
