// Run with:  node tests/admin-security.test.mjs
// Supabase is faked, with the SQL functions of migration 006 mirrored in JS, so this checks the
// Node side of the sign-in layers. The SQL itself is proven by running the migration (admin > Overview shows a check).
import assert from "node:assert/strict";
const { hashPassword, totp } = await import("../api/_admin.js");
Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: "k", ADMIN_SESSION_SECRET: "s".repeat(48), ADMIN_PASSWORD_HASH: hashPassword("correct horse battery"), ADMIN_EMAIL: "boss@example.com", ADMIN_TOTP_SECRET: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" });
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => { fn(); return 0; }; // the deliberate slow-down after a failure would make the test slow
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };

// ---- fake database
const db = { state: new Map(), login: new Map(), sessions: [], audit: [], down: false };
const json = (d, s = 200) => new Response(s === 204 ? null : JSON.stringify(d), { status: s });
const secs = (d) => Math.max(0, Math.ceil((d - Date.now()) / 1000));
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const t = u.pathname.split("/").pop(); const m = init.method || "GET"; const b = init.body ? JSON.parse(init.body) : null; const q = u.search;
  if (db.down) return json({ message: "relation does not exist" }, 404);
  if (u.pathname.includes("/rpc/")) {
    if (t === "admin_use_totp_step") { const last = db.state.get("totp_step") ?? 0; if (last < b.p_step) { db.state.set("totp_step", b.p_step); return json(true); } return json(false); }
    if (t === "admin_login_status") { const r = db.login.get(b.p_scope); return json(r?.locked_until ? secs(r.locked_until) : 0); }
    if (t === "admin_login_ok") { db.login.delete(b.p_scope); return json(null, 204); }
    if (t === "admin_login_fail") {
      const r = db.login.get(b.p_scope) || { fails: 0, level: 0, locked_until: 0 };
      r.fails++;
      if (r.fails >= b.p_max) { r.level++; r.locked_until = Date.now() + Math.min(86400, b.p_base_seconds * (b.p_escalate ? 2 ** (r.level - 1) : 1)) * 1000; r.fails = 0; }
      db.login.set(b.p_scope, r); return json([{ fails: r.fails, locked_seconds: secs(r.locked_until), level: r.level }]);
    }
  }
  if (t === "admin_audit") { if (m === "POST") { db.audit.push(b); return json(null, 201); } return json(db.audit.slice().reverse()); }
  if (t === "admin_sessions") {
    if (m === "POST") { db.sessions.push({ revoked_at: null, ...b }); return json(null, 201); }
    if (m === "DELETE") return json(null, 204);
    const id = q.match(/id=eq\.([0-9a-f-]+)/)?.[1];
    if (m === "GET") return json(id ? db.sessions.filter((s) => s.id === id) : db.sessions.filter((s) => !s.revoked_at));
    if (m === "PATCH") { for (const s of db.sessions) if ((!id || s.id === id) && !s.revoked_at || (id && s.id === id && b.last_seen)) Object.assign(s, b); return json(null, 204); }
  }
  return json({}, 404);
};
const handler = (await import("../api/mingt.js")).default;
const call = async (body, { ip = "1.1.1.1", ua = "Mozilla/5.0 Chrome/120 Windows", token } = {}) => {
  let out = {}; const res = { setHeader() {}, status(c) { out.code = c; return this; }, json(j) { out.body = j; return this; } };
  await handler({ method: "POST", body, headers: { host: "x.test", "x-forwarded-for": ip, "user-agent": ua, ...(token ? { authorization: "Bearer " + token } : {}) } }, res);
  return out;
};
// The real check accepts steps -1..+1 of "now"; to get distinct valid codes without waiting, the test advances the clock.
const realNow = Date.now.bind(Date); let skew = 0; Date.now = () => realNow() + skew;
const freshCode = () => { skew += 30000 * 3; return totp(process.env.ADMIN_TOTP_SECRET, Date.now()); };
const creds = (extra = {}) => ({ action: "login", email: "boss@example.com", password: "correct horse battery", code: freshCode(), ...extra });

await test("layer 1: two-factor is required, never skipped", async () => {
  const secret = process.env.ADMIN_TOTP_SECRET; delete process.env.ADMIN_TOTP_SECRET;
  const r = await call({ ...creds(), code: "" });
  assert.equal(r.code, 503); assert.equal(r.body.code, "NOT_CONFIGURED"); assert.match(r.body.error, /Two-factor/);
  process.env.ADMIN_TOTP_SECRET = secret;
  assert.equal((await call({ ...creds(), code: "" })).code, 401); // no code: refused
  assert.equal((await call({ ...creds(), code: "000000" }, { ip: "9.9.9.1" })).code, 401);
});
await test("layer 1: a good code signs in once; the same code cannot be reused", async () => {
  db.login.clear();
  const body = creds();
  const ok = await call(body, { ip: "2.2.2.2" });
  assert.equal(ok.code, 200); assert.ok(ok.body.token); assert.equal(ok.body.degraded, false);
  const again = await call(body, { ip: "2.2.2.3" });
  assert.equal(again.code, 401); assert.match(again.body.error, /already used/);
  assert.ok(db.audit.some((a) => a.action === "login.replayed_code"));
});
await test("layer 2: lockout after 5 failures per address, even with correct details; others unaffected", async () => {
  db.login.clear();
  for (let i = 0; i < 5; i++) assert.equal((await call({ ...creds(), password: "wrong" }, { ip: "3.3.3.3" })).code, 401);
  const locked = await call(creds(), { ip: "3.3.3.3" });
  assert.equal(locked.code, 429); assert.ok(locked.body.retryAfter > 600 && locked.body.retryAfter <= 900); // about 15 minutes (the test clock moves while it runs)
  assert.equal((await call(creds(), { ip: "3.3.3.4" })).code, 200);
  assert.ok(db.audit.some((a) => a.action === "login.locked"));
});
await test("layer 2: lock time doubles when it happens again", async () => {
  db.login.clear();
  const rec = () => db.login.get([...db.login.keys()].find((k) => k.startsWith("ip:")));
  for (let i = 0; i < 5; i++) await call({ ...creds(), password: "x" }, { ip: "4.4.4.4" });
  const first = secs(rec().locked_until);
  rec().locked_until = 0; // wait it out
  for (let i = 0; i < 5; i++) await call({ ...creds(), password: "x" }, { ip: "4.4.4.4" });
  assert.ok(secs(rec().locked_until) > first * 1.9);
});
await test("layer 2: guesses spread over many addresses still trip the overall lock", async () => {
  db.login.clear();
  for (let i = 0; i < 20; i++) await call({ ...creds(), password: "wrong" }, { ip: `5.5.${i}.1` });
  const r = await call(creds(), { ip: "6.6.6.6" });
  assert.equal(r.code, 429);
});
await test("layer 3: sessions are recorded, idle-limited, tied to the browser and revocable", async () => {
  db.login.clear(); db.sessions.length = 0;
  const login = await call(creds(), { ip: "7.7.7.7" }); const token = login.body.token;
  assert.equal(db.sessions.length, 1); assert.equal(login.body.idleMinutes, 30);
  assert.equal((await call({ action: "me" }, { ip: "7.7.7.7", token })).code, 200);
  // different browser
  const other = await call({ action: "me" }, { ip: "7.7.7.7", token, ua: "curl/8.0" });
  assert.equal(other.code, 401); assert.match(other.body.error, /browser/); assert.ok(db.audit.some((a) => a.action === "session.rejected"));
  // the mismatch ended the session for good, even for the real browser
  assert.equal((await call({ action: "me" }, { ip: "7.7.7.7", token })).code, 401);
});
await test("layer 3: idle timeout, address change is logged, revoke and sign out everywhere", async () => {
  db.login.clear(); db.sessions.length = 0;
  const token = (await call(creds(), { ip: "8.8.8.8" })).body.token;
  const row = db.sessions[0];
  assert.equal((await call({ action: "me" }, { ip: "8.8.4.4", token })).code, 200);
  assert.ok(db.audit.some((a) => a.action === "session.ip_changed"));
  const ov = await call({ action: "security_overview" }, { ip: "8.8.4.4", token });
  assert.equal(ov.body.sessions.length, 1); assert.equal(ov.body.sessions[0].current, true); assert.equal(ov.body.twoFactor, true);
  row.last_seen = new Date(Date.now() - 31 * 60000).toISOString();
  const idle = await call({ action: "me" }, { ip: "8.8.4.4", token });
  assert.equal(idle.code, 401); assert.match(idle.body.error, /inactivity/);
  // revoke
  const t2 = (await call(creds(), { ip: "8.8.8.8" })).body.token;
  const id = db.sessions.at(-1).id;
  assert.equal((await call({ action: "session_revoke", id }, { ip: "8.8.8.8", token: t2 })).code, 200);
  assert.equal((await call({ action: "me" }, { ip: "8.8.8.8", token: t2 })).code, 401);
  // everywhere
  const a = (await call(creds(), { ip: "8.8.8.8" })).body.token, b = (await call(creds(), { ip: "8.8.8.9" })).body.token;
  assert.equal((await call({ action: "sessions_revoke_all" }, { ip: "8.8.8.8", token: a })).code, 200);
  assert.equal((await call({ action: "me" }, { token: a, ip: "8.8.8.8" })).code, 401); assert.equal((await call({ action: "me" }, { token: b, ip: "8.8.8.9" })).code, 401);
  // logout
  const c = (await call(creds(), { ip: "8.8.8.8" })).body.token;
  await call({ action: "logout" }, { ip: "8.8.8.8", token: c });
  assert.equal((await call({ action: "me" }, { ip: "8.8.8.8", token: c })).code, 401);
});
await test("layer 3: a token that was never recorded is rejected", async () => {
  const { signToken } = await import("../api/_admin.js");
  const forged = signToken({ sub: "admin", iat: Date.now(), exp: Date.now() + 1e6, jti: "11111111-1111-4111-8111-111111111111" });
  assert.equal((await call({ action: "me" }, { token: forged })).code, 401);
});
await test("storage down at sign-in: reduced protection, never locked out; once signed in, fails closed", async () => {
  db.login.clear(); db.sessions.length = 0; db.down = true;
  const login = await call(creds(), { ip: "10.0.0.1" });
  assert.equal(login.code, 200); assert.equal(login.body.degraded, true);
  assert.equal((await call({ action: "me" }, { ip: "10.0.0.1", token: login.body.token })).code, 200); // degraded token
  db.down = false;
  const good = (await call(creds(), { ip: "10.0.0.2" })).body.token; db.down = true;
  assert.equal((await call({ action: "me" }, { ip: "10.0.0.2", token: good })).code, 503); // recorded session, storage unreachable: refuse
  db.down = false;
});
globalThis.setTimeout = realSetTimeout;
console.log(`\n${passed} tests passed`);
