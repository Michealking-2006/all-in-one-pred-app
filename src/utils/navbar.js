// iOS-style navigation bar behaviour, driven by scroll position:
//  - large titles collapse into the bar (the inline title fades in once the
//    large title has scrolled away)
//  - the bar's hairline/blur only appears once content scrolls beneath it
//  - the Games day strip pins to the top while its list scrolls
// Pure enhancement: with no scrolling everything simply shows its resting state.

const LARGE_TITLE = [
  ".page-intro h1", ".settings-intro h1", ".favorites-intro h1", ".vip-hero h1",
  ".search-hero h2", ".premium-hero h1", ".home-title",
].join(",");

let compact = null;
let queued = false;

function safeTop() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;height:env(safe-area-inset-top,0px);visibility:hidden";
  document.body.appendChild(probe);
  const value = probe.offsetHeight;
  probe.remove();
  return value;
}

function update() {
  queued = false;
  const y = window.scrollY;
  const header = document.querySelector("#root .page-header");
  const large = document.querySelector("#root " + LARGE_TITLE);
  const isHome = !!document.querySelector("#root .home-screen");

  if (header) {
    header.classList.toggle("is-scrolled", y > 1);
    header.classList.toggle("has-large-title", !!large);
    const collapsed = !large || large.getBoundingClientRect().bottom < header.offsetHeight;
    header.classList.toggle("show-title", collapsed);
  }

  // Tab-root screens (Leagues, VIP) have no bar: show a compact one on scroll.
  if (compact) {
    const show = !header && !isHome && !!large && large.getBoundingClientRect().bottom < 44 + safeTop();
    if (show) compact.firstChild.textContent = large.textContent.trim();
    compact.classList.toggle("visible", show);
  }

  const strip = document.querySelector("#root .home-screen .date-strip");
  if (strip) strip.classList.toggle("is-stuck", strip.getBoundingClientRect().top <= 0.5);
}

function schedule() {
  if (queued) return;
  queued = true;
  window.requestAnimationFrame(update);
}

export function initNavBars() {
  compact = document.createElement("div");
  compact.className = "nav-compact";
  compact.setAttribute("aria-hidden", "true");
  compact.appendChild(document.createElement("span"));
  document.body.appendChild(compact);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
}

export const syncNavBars = schedule;
