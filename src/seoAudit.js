// The page auditor behind admin > SEO: what a search engine sees on a page and what is wrong with it.
// Pure (works on the HTML text). Server and tests only; the app never loads it.
export function auditHtml(html, { canonical = "", indexable = true } = {}) {
  const issues = [];
  const add = (level, code, message) => issues.push({ level, code, message });
  const text = String(html || "");
  const grab = (re) => { const m = re.exec(text); return m ? m[1].trim() : ""; };
  const unescape = (v) => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const title = unescape(grab(/<title[^>]*>([\s\S]*?)<\/title>/i));
  const description = unescape(grab(/<meta\s+name="description"\s+content="([^"]*)"/i));
  const robots = grab(/<meta\s+name="robots"\s+content="([^"]*)"/i).toLowerCase();
  const canon = grab(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
  const ogImage = grab(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
  const h1s = (text.match(/<h1[\s>]/gi) || []).length;
  const links = (text.match(/<a\s[^>]*href="\//gi) || []).length;
  const lang = grab(/<html[^>]*\slang="([^"]*)"/i);
  const bodyText = (text.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  if (!title) add("error", "title-missing", "No <title>."); else if (title.length > 65) add("warn", "title-long", `Title is ${title.length} characters; search results cut it at about 60.`); else if (title.length < 15) add("warn", "title-short", `Title is only ${title.length} characters.`);
  if (!description) add("error", "description-missing", "No meta description."); else if (description.length < 70) add("warn", "description-short", `Description is ${description.length} characters; aim for 70 to 160.`); else if (description.length > 300) add("warn", "description-long", `Description is ${description.length} characters; it will be cut.`);
  if (!canon) add("error", "canonical-missing", "No canonical link."); else {
    if (!/^https:\/\//.test(canon)) add("warn", "canonical-not-https", "The canonical link is not https (set SITE_URL).");
    if (canonical && canon !== canonical) add("error", "canonical-mismatch", `Canonical is ${canon}, expected ${canonical}.`);
  }
  const noindex = /noindex/.test(robots);
  if (indexable && noindex) add("error", "noindex-by-mistake", "This page should be indexed but says noindex.");
  if (!indexable && !noindex) add("warn", "should-be-noindex", "This private page can be indexed.");
  if (h1s === 0) add("error", "h1-missing", "No <h1> heading."); else if (h1s > 1) add("warn", "h1-many", `${h1s} <h1> headings; use one.`);
  if (!lang) add("warn", "lang-missing", "No lang attribute on <html>.");
  if (indexable && !/^https:\/\//.test(ogImage)) add("warn", "og-image", "No absolute https og:image for link previews.");
  const ld = [...text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  let types = [];
  for (const m of ld) { try { const d = JSON.parse(m[1]); types.push(String(d["@type"] || "?")); if (!d["@type"]) add("warn", "ld-no-type", "A JSON-LD block has no @type."); } catch { add("error", "ld-invalid", "A JSON-LD block is not valid JSON."); } }
  if (indexable && !ld.length) add("warn", "ld-missing", "No structured data (JSON-LD).");
  if (indexable && links < 3) add("warn", "few-links", `Only ${links} internal links: crawlers need links to move on.`);
  if (indexable && bodyText.length < 200) add("warn", "thin-content", `Only ${bodyText.length} characters of readable text.`);
  return { title, description, canonical: canon, robots, h1s, links, types, textLength: bodyText.length, issues };
}
