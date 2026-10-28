// Startup safety net only. Once the app has rendered (window.__scoutwaveBooted),
// a stray error or rejected request must NOT replace the whole UI with a
// fatal screen: it is logged and the app keeps working.
// Lives in its own file (not inline in index.html) so the page's Content-Security-Policy can forbid inline scripts.
(function () {
  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }
  function showBootError(message) {
    if (window.__scoutwaveBooted) {
      console.error("Scoutwave runtime error:", message);
      return;
    }
    var root = document.getElementById("root");
    if (!root) return;
    var safe = String(message || "The app could not be loaded.");
    var button = node("button", "boot-button", "Reload");
    button.type = "button";
    button.addEventListener("click", function () { location.reload(); });
    var section = node("section", "boot-card");
    section.append(
      node("strong", "boot-title", "Scoutwave could not start"),
      node("span", "boot-note", "Please reload the app. If it keeps happening, check your connection and try again in a moment."),
      button
    );
    var main = node("main", "boot-screen");
    main.append(section);
    root.replaceChildren(main);
    console.error("Scoutwave boot error:", safe);
  }
  window.__scoutwaveBootError = showBootError;
  window.addEventListener("error", function (event) {
    if (event && event.error) showBootError(event.error.message || event.message);
  });
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event && event.reason;
    showBootError(reason && reason.message ? reason.message : reason);
  });
})();
