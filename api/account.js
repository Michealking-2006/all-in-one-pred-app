// One serverless function for the signed-in account endpoints (see api/public.js for why):
// /api/me, /api/spend and /api/checkout are rewritten here by vercel.json.
const ROUTES = {
  me: () => import("../server/me.js"),
  spend: () => import("../server/spend.js"),
  checkout: () => import("../server/checkout.js"),
};

export default async function handler(req, res) {
  const raw = Array.isArray(req.query?.route) ? req.query.route[0] : req.query?.route;
  const load = Object.prototype.hasOwnProperty.call(ROUTES, raw) ? ROUTES[raw] : null;
  if (!load) return res.status(404).json({ error: "Not found" });
  const { route, ...own } = req.query;
  req.query = own;
  return (await load()).default(req, res);
}
