#!/usr/bin/env node

/**
 * Deterministically splits the legacy pages.css into page-owned stylesheets.
 *
 * The source file is read directly inside GitHub Actions so large CSS blobs do
 * not need to pass through the connector. Marker matching is deliberately
 * tolerant of the number of asterisks used in legacy comments, but strict
 * about marker order and duplicate/missing headings.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "assets", "css", "pages.css");
const OUT_DIR = path.join(ROOT, "assets", "css", "pages");

const BLOCKS = [
  ["profile.css", "app profile page"],
  ["predictions.css", "prediction page"],
  ["edit-profile.css", "edit profile"],
  ["languages.css", "language page"],
  ["change-password.css", "change password page"],
  ["premium.css", "premium page"],
  ["favourites.css", "favourites page"],
  ["news.css", "news page"],
  ["coins.css", "coins page"],
].map(([file, heading]) => ({ file, heading }));

function readSource() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Missing source stylesheet: ${SOURCE}`);
  return fs.readFileSync(SOURCE, "utf8");
}

function markerRegex(heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Accept any legacy comment decoration around the canonical heading text.
  return new RegExp(`\\/\\*[^\\n]*${escaped}[^\\n]*\\*\\/`, "i");
}

function findMarkers(source) {
  const markers = [];
  for (const block of BLOCKS) {
    const regex = markerRegex(block.heading);
    const matches = [...source.matchAll(new RegExp(regex.source, "gi"))];
    if (matches.length === 0) {
      throw new Error(`Missing ${block.heading} marker in ${path.relative(ROOT, SOURCE)}`);
    }
    if (matches.length > 1) {
      throw new Error(`Duplicate ${block.heading} markers found in ${path.relative(ROOT, SOURCE)}`);
    }
    markers.push({ ...block, index: matches[0].index, marker: matches[0][0] });
  }

  for (let i = 1; i < markers.length; i += 1) {
    if (markers[i].index <= markers[i - 1].index) {
      throw new Error(
        `Invalid marker order: ${markers[i].heading} must appear after ${markers[i - 1].heading}.`
      );
    }
  }

  return markers;
}

function extract(source, markers) {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  markers.forEach((marker, index) => {
    const start = marker.index;
    const end = index + 1 < markers.length ? markers[index + 1].index : source.length;
    const content = source.slice(start, end).trim();

    if (!content) throw new Error(`Empty CSS block for ${marker.heading}.`);

    const header = [
      `/* ${marker.heading}. */`,
      "/* Generated from assets/css/pages.css. */",
      "/* Run: node scripts/extract-page-css.js */",
      "",
    ].join("\n");

    fs.writeFileSync(path.join(OUT_DIR, marker.file), `${header}${content}\n`, "utf8");
    console.log(`[write] assets/css/pages/${marker.file}`);
  });
}

function main() {
  const source = readSource();
  const markers = findMarkers(source);
  extract(source, markers);
  console.log(`\n[ok] Extracted ${markers.length}/${BLOCKS.length} mapped page blocks.`);
  console.log("[info] assets/css/pages.css was not modified.");
}

main();
