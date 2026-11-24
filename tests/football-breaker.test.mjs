// Run with:  node tests/football-breaker.test.mjs   (no network)
// When the football provider refuses us, the proxy must stop calling it instead of asking again for every visitor.
import assert from "node:assert/strict";
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
process.env.SCOUTWAVE_FOOTBALL_API_KEY = "test-key";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const { resetBreaker, waitFor } = await import("../api/_breaker.js");
const { default: handler } = await import("../api/football.js");
const call = async (id) => {
  const out = { headers: {} };
  const res = { setHeader: (k, v) => { out.headers[k] = v; }, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; } };
  await handler({ method: "GET", query: { endpoint: "leagues", id: String(id) } }, res);
  return out;
};
const reply = (body, headers = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...headers } });

await test("after a refusal the provider is not called again", async () => {
  resetBreaker(); let calls = 0;
  globalThis.fetch = async (u) => { if (String(u).endsWith("/status")) return reply({ response: [] }); calls++; return reply({ errors: { access: "Your account is suspended." }, response: [] }); };
  assert.equal((await call(1)).code, 502);
  for (let i = 2; i < 12; i++) { const r = await call(i); assert.equal(r.code, 502); assert.ok(Number(r.headers["Retry-After"]) > 0); assert.equal(r.headers["Cache-Control"], "no-store"); }
  assert.equal(calls, 1, "provider was asked " + calls + " times");
});

await test("the daily limit stops calls and tells the app to wait", async () => {
  resetBreaker(); let calls = 0;
  globalThis.fetch = async (u) => { if (String(u).endsWith("/status")) return reply({ response: [] }); calls++; return reply({ errors: { requests: "You have reached the request limit for the day" }, response: [] }); };
  assert.equal((await call(1)).code, 429);
  const again = await call(2);
  assert.equal(again.code, 429); assert.equal(again.body.code, "FOOTBALL_API_RATE_LIMIT"); assert.ok(again.body.retryAfter > 0);
  assert.equal(calls, 1);
});

await test("it stops before the limit is hit, using the provider's own counter", async () => {
  resetBreaker(); let calls = 0;
  globalThis.fetch = async (u) => { if (String(u).endsWith("/status")) return reply({ response: [] }); calls++; return reply({ errors: [], response: [{ id: 1 }] }, { "x-ratelimit-requests-remaining": "3", "x-ratelimit-remaining": "9" }); };
  assert.equal((await call(1)).code, 200);
  assert.equal((await call(2)).code, 429);
  assert.equal(calls, 1);
});

await test("a request the plan doesn't cover does not stop everything", async () => {
  resetBreaker(); let calls = 0;
  globalThis.fetch = async (u) => { if (String(u).endsWith("/status")) return reply({ response: [] }); calls++; return reply({ errors: { plan: "Free plans do not have access to this season." }, response: [] }); };
  await call(1); await call(2);
  assert.equal(calls, 2);
});

await test("normal answers are untouched", async () => {
  resetBreaker();
  globalThis.fetch = async () => reply({ errors: [], response: [{ id: 39 }] }, { "x-ratelimit-requests-remaining": "7000", "x-ratelimit-remaining": "250" });
  const r = await call(39); assert.equal(r.code, 200); assert.deepEqual(r.body, [{ id: 39 }]);
});

await test("usage is checked before each provider call, not only after", async () => {
  resetBreaker(); let calls = 0, status = 0;
  globalThis.fetch = async (u) => {
    if (String(u).endsWith("/status")) { status++; return reply({ response: { requests: { current: 7497, limit_day: 7500 }, subscription: { plan: "Pro" } } }); }
    calls++; return reply({ errors: [], response: [{ id: 1 }] });
  };
  const r = await call(1);
  assert.equal(r.code, 429); assert.equal(r.body.code, "FOOTBALL_API_RATE_LIMIT");
  assert.equal(calls, 0, "the provider must not be asked when the day is used up"); assert.equal(status, 1);
});

await test("calls made since the last usage check count too", async () => {
  resetBreaker(); let calls = 0;
  globalThis.fetch = async (u) => {
    if (String(u).endsWith("/status")) return reply({ response: { requests: { current: 100, limit_day: 112 }, subscription: { plan: "Free" } } });
    calls++; return reply({ errors: [], response: [{ id: 1 }] });
  };
  for (let i = 1; i <= 10; i++) await call(i);
  assert.ok(calls <= 7, "asked " + calls + " times with only 12 left and a floor of 5");
});

await test("wait times: the day's limit lasts until the provider's day rolls over", () => {
  const noon = Date.UTC(2026, 10, 19, 12, 0, 0);
  assert.ok(waitFor("quota", noon) > 3600 && waitFor("quota", noon) <= 6 * 3600);
  assert.equal(waitFor("rate"), 65); assert.equal(waitFor("plan"), 0);
});
console.log(passed + " passed");
