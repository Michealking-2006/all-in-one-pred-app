// The ONLY way a value from outside (a request, a provider, a row read back) may enter a
// database URL. The data layer is Supabase's PostgREST: there is no hand-written SQL, so
// "SQL injection" here means smuggling extra filters or operators into a query string
// (for example an id such as "1&user_id=neq.0", or a search term with "),or=(").
// Every helper either returns a value that is safe to place in the URL or throws a 400.
// tests/security.test.mjs fails if any api/ file builds a query another way.
import { HttpError } from "./_admin.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (what) => new HttpError(400, `Bad ${what}.`);

export const q = {
  uuid(v) { const s = String(v ?? ""); if (!UUID.test(s)) throw bad("id"); return s.toLowerCase(); },
  uuids(list) { return (Array.isArray(list) ? list : []).map((v) => q.uuid(v)).join(","); },
  int(v) { const n = typeof v === "string" && /^\d{1,15}$/.test(v) ? Number(v) : v; if (!Number.isSafeInteger(n) || n < 0) throw bad("number"); return String(n); },
  ints(list) { const a = Array.isArray(list) ? list : []; if (a.length > 500) throw bad("list"); return a.map((v) => q.int(v)).join(","); },
  day(v) { const s = String(v ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw bad("date"); return s; },
  // A moment in time, as a URL-encoded ISO string. Accepts a Date, a number of ms or an ISO string.
  iso(v) { const t = new Date(v).getTime(); if (!Number.isFinite(t)) throw bad("time"); return encodeURIComponent(new Date(t).toISOString()); },
  // A fixed word (status, action name, model version): letters, digits, dot, dash, underscore only.
  word(v) { const s = String(v ?? ""); if (!/^[A-Za-z0-9._-]{1,64}$/.test(s)) throw bad("value"); return s; },
  // Several fixed words for an in.(...) filter.
  words(list) { return (Array.isArray(list) ? list : []).map((v) => `"${q.word(v)}"`).join(","); },
  // Free text (an endpoint address, an order id) for an eq. filter: percent-encoded, so it can't end the value.
  // encodeURIComponent leaves ! ' ( ) * alone; those are escaped as well so nothing can look like filter syntax.
  text(v, max = 700) { const s = String(v ?? ""); if (!s || s.length > max) throw bad("value"); return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()); },
  // A search term for ilike: only letters, digits and a few harmless symbols survive, wrapped in quotes.
  like(v) {
    const t = String(v ?? "").normalize("NFKC").replace(/[^\p{L}\p{N}@._\- ]/gu, "").replace(/\s+/g, " ").trim().slice(0, 60);
    return t ? encodeURIComponent(`"*${t}*"`) : "";
  },
};
