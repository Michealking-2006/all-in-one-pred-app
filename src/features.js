// Feature flags. Order of precedence: this device's override, then the flag set
// from the admin dashboard (/mingt-t), then the default below. A single device can be
// switched without a deploy:
//   open the app with  ?flag=predictions:on   (or :off), or
//   localStorage.setItem("scoutwave.flag.predictions", "on")
import { remoteFlag } from "./remoteConfig.js";

export const FEATURE_DEFAULTS = {
  predictions: false,     // Scoutwave's own prediction model (never API-Football's)
  advancedThemes: true,   // kill switch for the animated themes (Fire, Water, Ice, Bubbles)
};

const keyOf = (name) => "scoutwave.flag." + name;

function storage() {
  try { return window.localStorage; } catch { return null; }
}

// Pick up ?flag=name:on|off once and remember it for this device.
function readUrlOverrides() {
  try {
    const raw = new URLSearchParams(window.location.search).getAll("flag");
    for (const entry of raw) {
      const [name, value] = entry.split(":");
      if (name in FEATURE_DEFAULTS && (value === "on" || value === "off")) storage()?.setItem(keyOf(name), value);
    }
  } catch { /* not critical */ }
}

export function isFeatureOn(name) {
  readUrlOverrides();
  const saved = storage()?.getItem(keyOf(name));
  if (saved === "on") return true;
  if (saved === "off") return false;
  const remote = remoteFlag(name); // set from the admin dashboard
  if (typeof remote === "boolean") return remote;
  return !!FEATURE_DEFAULTS[name];
}
