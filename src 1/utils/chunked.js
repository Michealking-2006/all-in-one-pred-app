// Draw a long list in pieces instead of all at once. A busy match day can have 60+ competitions and
// 500+ matches; building every row up front costs time before the first paint and a lot of memory.
// The first pieces appear immediately. The rest follow when the reader scrolls near them (lighter
// phones) or when the browser is idle (everyone else), so the full list is always there in the end.
import { h } from "./h.js";
import { isLowEnd } from "../perf.js";

export function appendInPieces(container, items, build, { first = 10, batch = 8, isStale = () => false } = {}) {
  const firstCount = isLowEnd() ? Math.max(4, Math.floor(first / 2)) : first;
  items.slice(0, firstCount).forEach((item) => container.appendChild(build(item)));
  let next = firstCount;
  if (next >= items.length) return;

  const more = () => {
    const end = Math.min(items.length, next + batch);
    const frag = document.createDocumentFragment();
    for (; next < end; next++) frag.appendChild(build(items[next]));
    return frag;
  };

  if (isLowEnd() && "IntersectionObserver" in window) {
    // Scroll-driven: nothing more is built until the reader gets close to the end of what is drawn.
    const sentinel = h("div", { className: "list-sentinel", "aria-hidden": "true" });
    container.appendChild(sentinel);
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      if (isStale() || !container.isConnected) { observer.disconnect(); sentinel.remove(); return; }
      container.insertBefore(more(), sentinel);
      if (next >= items.length) { observer.disconnect(); sentinel.remove(); }
    }, { rootMargin: "900px 0px" });
    observer.observe(sentinel);
    return;
  }

  // Idle-driven: finish the list in the background without blocking taps or scrolling.
  const idle = window.requestIdleCallback || ((fn) => window.setTimeout(() => fn({ timeRemaining: () => 8 }), 16));
  const step = () => {
    if (isStale() || !container.isConnected) return;
    container.appendChild(more());
    if (next < items.length) idle(step, { timeout: 400 });
  };
  idle(step, { timeout: 400 });
}
