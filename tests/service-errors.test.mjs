// Run with:  node tests/service-errors.test.mjs   (no network)
// The real reason a provider refuses us (suspended account, bad key, limit) is for the admin only:
// the proxy's answer to the browser must never contain it.
import assert from "node:assert/strict";
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const { classifyError, classifyText } = await import("../api/_errors.js");

await test("a suspended or blocked account is told apart from a missing key or a limit", () => {
  assert.equal(classifyError({ access: "Your account is suspended." }, 200).kind, "banned");
  assert.equal(classifyError({ token: "This account has been blocked." }, 200).kind, "banned");
  assert.equal(classifyError({ requests: "You have reached the request limit for the day" }, 200).kind, "quota");
  assert.equal(classifyError({ token: "Error/Missing application key." }, 200).kind, "key");
  assert.equal(classifyError({ rateLimit: "Too many requests." }, 200).kind, "rate");
  assert.equal(classifyText("Insufficient Balance", 402).kind, "quota");
  assert.equal(classifyText("", 401).kind, "key");
});

await test("the football proxy keeps the provider's words away from the browser", async () => {
  process.env.SCOUTWAVE_FOOTBALL_API_KEY = "test-key";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY; // nothing is logged in this test
  const secret = "Your account is suspended. Contact api-sports support (key abc123).";
  globalThis.fetch = async () => new Response(JSON.stringify({ errors: { access: secret }, response: [] }), { status: 200, headers: { "content-type": "application/json" } });
  const { default: handler } = await import("../api/football.js");
  const out = { headers: {} };
  const res = { setHeader: (k, v) => { out.headers[k] = v; }, status(code) { out.code = code; return this; }, json(body) { out.body = body; return this; } };
  await handler({ method: "GET", query: { endpoint: "leagues", id: "39" } }, res);
  const text = JSON.stringify(out.body);
  assert.equal(out.code, 502);
  assert.ok(!/suspend|abc123|api-sports|support|details/i.test(text), "leaked: " + text);
  assert.equal(out.body.code, "FOOTBALL_API_PROVIDER_ERROR");
});

await test("a limit still tells the app to back off, without the provider's text", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ errors: { requests: "You have reached the request limit for the day, Go to https://dashboard.api-football.com" }, response: [] }), { status: 200, headers: { "content-type": "application/json" } });
  const { default: handler } = await import("../api/football.js");
  const out = { headers: {} };
  const res = { setHeader: (k, v) => { out.headers[k] = v; }, status(code) { out.code = code; return this; }, json(body) { out.body = body; return this; } };
  await handler({ method: "GET", query: { endpoint: "leagues", id: "40" } }, res);
  assert.equal(out.code, 429);
  assert.equal(out.body.code, "FOOTBALL_API_RATE_LIMIT");
  assert.ok(!/dashboard|api-football|limit for the day/i.test(JSON.stringify(out.body)));
});

console.log(`\n${passed} passed`);
