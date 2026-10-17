import { siteOrigin } from "./_site.js";

export default function handler(req, res) {
  const origin = siteOrigin(req);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=86400");
  res.status(200).send([
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /auth",
    "Disallow: /profile",
    "Disallow: /edit-profile",
    "Disallow: /change-password",
    "Disallow: /coins",
    "Disallow: /premium",
    "Disallow: /themes",
    "Disallow: /mingt-t",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n"));
}
