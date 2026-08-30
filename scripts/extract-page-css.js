#!/usr/bin/env node

/**
 * Deterministically splits the legacy pages.css into page-owned stylesheets.
 *
 * The source file is read directly inside GitHub Actions so large CSS blobs do
 * not need to pass through the connector. Marker matching is deliberately
 * tolerant of legacy comment decoration and duplicate descriptive comments.
 * The first valid marker for each page, after the previous page marker, is
 * selected; marker order is then enforced before any files are written.
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
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Missing source stylesheet: ${SOURCE}`);
  }
  return fs.readFileSync(SOURCE, "utf8");
}

function markerRegex(heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\/\\*[^\\n]*${escaped}[^\\n]*\\*\\/`, "i");
}

function findNextMarker(source, heading, fromIndex) {
  const regex = markerRegex(heading);
  const tail = source.slice(fromIndex);
  const match = tail.match(regex);

  if (!match) {
    throw new Error(
      `Missing ${heading} marker after byte ${fromIndex} in ${path.relative(ROOT, SOURCE)}`
    );
  }

  return {
    index: fromIndex + match.index,
    marker: match[0],
  };
}

function findMarkers(source) {
  const markers = [];
  let cursor = 0;

  for (const block of BLOCKS) {
    const found = findNextMarker(source, block.heading, cursor);
    markers.push({ ...block, ...found });
    cursor = found.index + found.marker.length;
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

  const outputs = markers.map((marker, index) => {
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

    return {
      path: path.join(OUT_DIR, marker.file),
      content: `${header}${content}\n`,
      file: marker.file,
    };
  });

  // Only write after every marker and every extracted block has been validated.
  for (const output of outputs) {
    fs.writeFileSync(output.path, output.content, "utf8");
    console.log(`[write] assets/css/pages/${output.file}`);
  }
}

function main() {
  const source = readSource();
  const markers = findMarkers(source);
  extract(source, markers);
  console.log(`\n[ok] Extracted ${markers.length}/${BLOCKS.length} mapped page blocks.`);
  console.log("[info] assets/css/pages.css was not modified.");
}

main();
