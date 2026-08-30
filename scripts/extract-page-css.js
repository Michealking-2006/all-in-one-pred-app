#!/usr/bin/env node

/**
 * Deterministically splits the legacy pages.css into page-owned stylesheets.
 *
 * Usage:
 *   node scripts/extract-page-css.js
 *
 * The script is intentionally conservative: it only moves blocks whose
 * headings are explicitly mapped below. Everything else remains in pages.css.
 *
 * Important:
 * - pages.css currently contains 9 page blocks.
 * - The remaining global/shared rules (including font declarations and the
 *   global cursor rule) are intentionally NOT moved by this script.
 * - The script fails loudly when a mapped marker is missing or appears in an
 *   invalid order, preventing a partial/unsafe migration.
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

function findMarker(source, regex, label) {
  const match = source.match(regex);
  if (!match) {
    throw new Error(`Missing ${label} marker in ${path.relative(ROOT, SOURCE)}`);
  }
  return match;
}

function extract(source, block, previousEnd) {
  const startMatch = findMarker(source, block.start, `${block.heading} start`);
  const start = startMatch.index;

  if (start < previousEnd) {
    throw new Error(
      `Invalid marker order: ${block.heading} starts before the previous block ends.`
    );
  }

  const endMatch = block.end
    ? source.slice(start + startMatch[0].length).match(block.end)
    : null;

  if (block.end && !endMatch) {
    throw new Error(`Missing ${block.heading} end marker in ${path.relative(ROOT, SOURCE)}`);
  }

  const end = endMatch
    ? start + startMatch[0].length + endMatch.index
    : source.length;

  if (end <= start) {
    throw new Error(`Invalid empty block detected for ${block.heading}.`);
  }

  return {
    start,
    end,
    content: source.slice(start, end).trim() + "\n",
  };
}

function main() {
  const source = readSource();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let previousEnd = 0;
  let extractedCount = 0;

  for (const block of BLOCKS) {
    const result = extract(source, block, previousEnd);
    previousEnd = result.end;

    const header = [
      `/* ${block.heading}. */`,
      `/* Generated from assets/css/pages.css. */`,
      `/* Run: node scripts/extract-page-css.js */`,
      "",
    ].join("\n");

    const outputPath = path.join(OUT_DIR, block.file);
    fs.writeFileSync(outputPath, header + result.content, "utf8");
    extractedCount += 1;
    console.log(`[write] ${path.relative(ROOT, outputPath)}`);
  }

  console.log(`\n[ok] Extracted ${extractedCount}/${BLOCKS.length} mapped page blocks.`);
  console.log(
    "[info] Shared/global rules remain in assets/css/pages.css until the final migration audit."
  );
}

main();
