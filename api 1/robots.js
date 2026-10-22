import { siteOrigin } from "./_site.js";
import { env } from "./_admin.js";

const PRIVATE = ["/api/", "/mingt-t", "/auth", "/profile", "/edit-profile", "/change-password", "/coins", "/premium", "/themes", "/notifications", "/favorites", "/appearance", "/language", "/feedback", "/report-issue", "/avatar"];

// AI crawlers. robots.txt is a request that well-behaved crawlers honour, not enforcement. Names are the ones the
// vendors publish today; check their documentation from time to time, they change.
const AI_TRAINING = ["GPTBot", "Google-Extended", "CCBot", "ClaudeBot", "anthropic-ai", "Bytespider", "Applebot-Extended", "meta-externalagent", "cohere-ai", "Diffbot", "Amazonbot"];
const AI_SEARCH = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot"];

export function robotsText(origin, ai = "allow") {
  const lines = ["User-agent: *", "Allow: /", ...PRIVATE.map((p) => `Disallow: ${p}`), ""];
  const blocked = ai === "block" ? [...AI_TRAINING, ...AI_SEARCH] : ai === "training-only" ? AI_TRAINING : [];
  for (const agent of blocked) lines.push(`User-agent: ${agent}`, "Disallow: /", "");
  lines.push(`Sitemap: ${origin}/sitemap.xml`, "");
  return lines.join("\n");
}

export default function handler(req, res) {
  const ai = ["block", "training-only"].includes(env("AI_CRAWLERS")) ? env("AI_CRAWLERS") : "allow";
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=86400");
  res.status(200).send(robotsText(siteOrigin(req), ai));
}
