// Feature flags. Defaults live here; anyone can switch a flag on a single
// device without a deploy:
//   open the app with  ?flag=predictions:on   (or :off), or
//   localStorage.setItem("scoutwave.flag.predictions", "on")
export const FEATURE_DEFAULTS = {
  predictions: false, // Scoutwave's own prediction model (never API-Football's)
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
  return !!FEATURE_DEFAULTS[name];
}
