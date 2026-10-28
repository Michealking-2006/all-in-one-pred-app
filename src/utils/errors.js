// What a person may be shown when something fails. Our own messages are written for people ("Couldn't load
// this match. Try again."); but errors can also come from the browser, the network or a service, and those
// can name technologies, settings, status codes or code. Nothing like that may reach a screen: it tells an
// attacker what the app is built on and tells everyone else nothing useful. The detail goes to the console.
export const GENERIC_ERROR = "Something went wrong. Please try again.";

const TECHNICAL = new RegExp([
  // the browser / JavaScript
  "undefined", "\\bnull\\b", "is not a function", "is not defined", "cannot read", "cannot access", "unexpected (token|end)", "\\bjson\\b",
  "syntaxerror", "typeerror", "referenceerror", "rangeerror", "networkerror", "failed to fetch", "load failed", "aborterror",
  "chunk", "dynamically imported", "importing a module", "missing screen", "\\bmodule\\b", "stack", "\\bat \\w+ \\(",
  // services, settings and secrets
  "api[ _-]?key", "apikey", "secret", "token", "supabase", "vercel", "postgres", "polar", "formspree", "openai", "api-?football", "api-?sports",
  "thenewsapi", "news_access", "scoutwave_", "\\benv", "\\.env", "readme", "docs/", "migration", "service[ _-]?role", "\\brls\\b", "webhook",
  "\\bcron\\b", "proxy", "endpoint", "serverless", "function logs", "deploy", "configur", "not set", "set up yet", "credentials? (is|are) ",
  "\\brelation\\b", "does not exist", "\\bcolumn\\b", "constraint", "violates", "duplicate key", "permission denied", "row[- ]level", "\\bschema\\b", "\\bquery\\b",
  "\\bcors\\b", "\\bsql\\b", "\\bjwt\\b", "\\bhttp\\b", "\\bapi\\b", "\\bserver\\b", "\\bbackend\\b",
  // status codes
  "\\(\\s*\\d{3}\\s*\\)", "\\berror \\d{3}\\b", "status \\d{3}", "\\b[45]\\d\\d\\b",
].join("|"), "i");

// text -> text that is safe to show, or the fallback.
export function publicText(message, fallback = GENERIC_ERROR) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text || text.length > 200 || TECHNICAL.test(text)) return fallback;
  return text;
}

// error -> text that is safe to show. Logs the real message so it can still be found while debugging.
export function safeMessage(error, fallback = GENERIC_ERROR) {
  const raw = error && typeof error === "object" ? error.message : error;
  const shown = publicText(raw, fallback);
  if (shown === fallback && raw && typeof console !== "undefined") console.warn("Hidden from the screen:", String(raw).slice(0, 300));
  return shown;
}
