function isStandalonePWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

function initPullToRefresh(onRefresh, options = {}) {
  const root = options.root || document.querySelector("#root");
  const content = options.content || document.querySelector("#main-page");
  const indicator = options.indicator || document.querySelector(".ptr-indicator");

  if (!root || !content || !indicator) return;

  let startY = 0;
  let currentY = 0;
  let pulling = false;
  let refreshing = false;
  let triggered = false;

  const MAX_PULL = 130;
  const TRIGGER = 85;
  const START_ZONE = 90;

  const getScrollTop = () => {
    return window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;
  };

  const ease = (distance) => {
    if (distance <= 0) return 0;
    return Math.min(MAX_PULL, distance * 0.45 + Math.sqrt(distance) * 2);
  };

  const resetVisuals = () => {
    content.style.transform = "";
    content.classList.remove("dragging");
    indicator.classList.remove("active", "loading");
    indicator.style.transform = "";
  };

  root.addEventListener("touchstart", (e) => {
    if (refreshing) return;
    if (getScrollTop() > 0) return;

    const y = e.touches[0].clientY;
    if (y > START_ZONE) return;

    startY = y;
    currentY = y;
    pulling = true;
    triggered = false;
    content.classList.add("dragging");
  }, { passive: true });

  root.addEventListener("touchmove", (e) => {
    if (!pulling || refreshing) return;

    currentY = e.touches[0].clientY;
    const distance = currentY - startY;

    if (distance <= 0) return;

    if (getScrollTop() > 0) {
      pulling = false;
      resetVisuals();
      return;
    }

    e.preventDefault();
    triggered = true;

    const pull = ease(distance);

    content.style.transform = `translate3d(0, ${pull}px, 0)`;
    indicator.classList.add("active");
    indicator.style.transform = `translate(-50%, ${Math.min(pull - 70, 20)}px)`;
  }, { passive: false });

  root.addEventListener("touchend", async () => {
    if (!pulling) return;

    pulling = false;
    content.classList.remove("dragging");

    const distance = currentY - startY;

    if (triggered && distance >= TRIGGER && !refreshing) {
      refreshing = true;
      indicator.classList.add("loading");
      content.style.transform = "translate3d(0, 70px, 0)";

      try {
        await Promise.resolve(onRefresh && onRefresh());
      } catch (err) {
        console.error(err);
      }

      setTimeout(() => {
        refreshing = false;
        resetVisuals();
      }, 300);
    } else {
      resetVisuals();
    }

    startY = 0;
    currentY = 0;
    triggered = false;
  }, { passive: true });
}

async function refreshCurrentPage() {
  const path = window.location.pathname;

  if (typeof navigate === "function") {
    await navigate(path, false);
  } else {
    window.location.reload();
  }

  document.dispatchEvent(new CustomEvent("pageRefreshed", {
    detail: { path }
  }));
}

if (isStandalonePWA()) {
  document.documentElement.classList.add("pwa-standalone");

  initPullToRefresh(refreshCurrentPage, {
    root: document.querySelector("#root"),
    content: document.querySelector("#main-page"),
    indicator: document.querySelector(".ptr-indicator")
  });
}
