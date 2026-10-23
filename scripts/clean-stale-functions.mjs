// Removes the old endpoint files that moved from api/ to server/ in version 0.27.1.
//
// Why this exists: copying a new version of the project over an old one adds and replaces files but never deletes
// the ones that were removed. The old api/accuracy.js, api/config.js ... would stay behind, each would still count as
// a serverless function, and Vercel's free (Hobby) plan refuses a deployment with more than 12.
//
//   node scripts/clean-stale-functions.mjs --dry    shows what would be deleted
//   node scripts/clean-stale-functions.mjs          deletes it, then prints the functions that remain
//
// A file is only deleted when the same handler already exists in server/ (so nothing can be lost).
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const MOVED = ["accuracy", "checkout", "config", "csp-report", "feed", "feedback", "llms", "me", "news", "placement-event", "predictions", "push", "robots", "sitemap", "spend", "usage"];
const dry = process.argv.includes("--dry");

let removed = 0;
for (const name of MOVED) {
  const old = path.join(root, "api", `${name}.js`), now = path.join(root, "server", `${name}.js`);
  if (!fs.existsSync(old)) continue;
  if (!fs.existsSync(now)) { console.log(`KEEP    api/${name}.js (server/${name}.js is missing, so this one is the only copy)`); continue; }
  console.log(`${dry ? "WOULD DELETE" : "DELETE"} api/${name}.js`);
  if (!dry) fs.rmSync(old);
  removed++;
}

const functions = fs.readdirSync(path.join(root, "api")).filter((n) => /\.(js|mjs|cjs|ts)$/.test(n) && !n.startsWith("_"));
console.log(`\n${removed} old file${removed === 1 ? "" : "s"} ${dry ? "found" : "removed"}.`);
console.log(`Serverless functions in api/ now${dry ? " (before deleting)" : ""}: ${functions.length} (the free plan allows 12)`);
console.log("  " + functions.sort().join(", "));
if (!dry && functions.length > 10) console.log("\nStill more than 10: something else in api/ should move to server/ (see docs/DEPLOY.md).");
