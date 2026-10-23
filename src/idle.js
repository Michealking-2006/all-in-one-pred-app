// Run something once the first screen is up and the browser has a quiet moment, so it doesn't compete with
// the first paint. The timeout makes sure it still runs soon on a busy page.
export const whenIdle = (fn, timeout = 1500) =>
  typeof window !== "undefined" && window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout }) : window.setTimeout(fn, 250);
