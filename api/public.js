// One serverless function for the app's small public endpoints. Vercel's free (Hobby) plan allows 12 functions per
// deployment and every file in api/ counts as one, so the handlers live in server/ and this entry point calls them.
// The addresses people and the app use are unchanged: vercel.json rewrites /api/config to /api/public?route=config and so on.
// Handlers are loaded on demand, so a request only pays for the code it needs.
const ROUTES = {
  config: () => import("../server/config.js"),
  accuracy: () => import("../server/accuracy.js"),
  predictions: () => import("../server/predictions.js"),
  usage: () => import("../server/usage.js"),
  "placement-event": () => import("../server/placement-event.js"),
  "csp-report": () => import("../server/csp-report.js"),
  feedback: () => import("../server/feedback.js"),
  push: () => import("../server/push.js"),
  news: () => import("../server/news.js"),
};

export default async function handler(req, res) {
  const raw = Array.isArray(req.query?.route) ? req.query.route[0] : req.query?.route;
  const load = Object.prototype.hasOwnProperty.call(ROUTES, raw) ? ROUTES[raw] : null;
  if (!load) return res.status(404).json({ error: "Not found" });
  const { route, ...own } = req.query; // the handler sees only its own parameters
  req.query = own;
  return (await load()).default(req, res);
}
