#!/usr/bin/env node

/**
 * Deterministically splits the legacy pages.css into page-owned stylesheets.
 *
 * Usage:
 *   node scripts/extract-page-css.js
 *
 * The script is intentionally conservative: it only moves blocks whose
 * headings are explicitly mapped below. Everything else remains in pages.css.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "assets", "css", "pages.css");
const OUT_DIR = path.join(ROOT, "assets", "css", "pages");

const BLOCKS = [
  {
    file: "profile.css",
    start: /\/\*\*\*\*\*\* app profile page \*+\//i,
    end: /\/\*\*\*\*\* prediction page \*+\//i,
    heading: "Profile page",
  },
  {
    file: "predictions.css",
    start: /\/\*\*\*\*\* prediction page \*+\//i,
    end: /\/\*\*\*\*\* edit profile \*+\//i,
    heading: "Predictions page",
  },
  {
    file: "edit-profile.css",
    start: /\/\*\*\*\*\* edit profile \*+\//i,
    end: /\/\*\*\*\*\* language page \*+\//i,
    heading: "Edit profile page",
  },
  {
    file: "languages.css",
    start: /\/\*\*\*\*\* language page \*+\//i,
    end: /\/\*\*\*\*\* change password page \*+\//i,
    heading: "Language page",
  },
  {
    file: "change-password.css",
    start: /\/\*\*\*\*\* change password page \*+\//i,
    end: /\/\*\*\*\*\* premium page \*+\//i,
    heading: "Change password page",
  },
  {
    file: "premium.css",
    start: /\/\*\*\*\*\* premium page \*+\//i,
    end: /\/\*\*\*\*\* favourites page \*+\//i,
    heading: "Premium page",
  },
  {
    file: "favourites.css",
    start: /\/\*\*\*\*\* favourites page \*+\//i,
    end: /\/\*\*\*\*\* news page \*+\//i,
    heading: "Favourites page",
  },
  {
    file: "news.css",
    start: /\/\*\*\*\*\* news page \*+\//i,
    end: /\/\*\*\*\*\* coins page \*+\//i,
    heading: "News page",
  },
  {
    file: "coins.css",
    start: /\/\*\*\*\*\* coins page \*+\//i,
    end: null,
    heading: "Coins page",
  },
];

function readSource() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Missing source stylesheet: ${SOURCE}`);
  }
  return fs.readFileSync(SOURCE, "utf8");
}

function extract(source, block) {
  const startMatch = source.match(block.start);
  if (!startMatch) {
    return null;
  }

  const start = startMatch.index;
  const endMatch = block.end ? source.slice(start + startMatch[0].length).match(block.end) : null;
  const end = endMatch
    ? start + startMatch[0].length + endMatch.index
    : source.length;

  return {
    start,
    end,
    content: source.slice(start, end).trim() + "\n",
  };
}

function main() {
  const source = readSource();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const block of BLOCKS) {
    const result = extract(source, block);
    if (!result) {
      console.warn(`[skip] ${block.heading}: marker not found`);
      continue;
    }

    const header = [
      `/* ${block.heading}. */`,
      `/* Generated from assets/css/pages.css. */`,
      `/* Run: node scripts/extract-page-css.js */`,
      "",
    ].join("\n");

    const output = header + result.content;
    fs.writeFileSync(path.join(OUT_DIR, block.file), output, "utf8");
    console.log(`[write] ${path.relative(ROOT, path.join(OUT_DIR, block.file))}`);
  }
}

main();
