// Pull-to-refresh is a touch gesture nobody needs in the first second, so its code (7 KB) loads when the browser is idle.
// The screen can set its refresh handler straight away; it is passed on as soon as the real module is ready.
import { whenIdle } from "./idle.js";

let handler = null, real = null;
export function setRefreshHandler(fn) { handler = fn; real?.setRefreshHandler(fn); }
export function initPullToRefresh() {
  whenIdle(async () => {
    try {
      real = await import("./pullToRefresh.js");
      real.initPullToRefresh();
      if (handler) real.setRefreshHandler(handler);
    } catch { /* the gesture is a convenience; the app works without it */ }
  });
}
