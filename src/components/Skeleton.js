import { h } from "../utils/h.js";

// Tracks which image URLs have successfully loaded at least once. Every
// store.setState rebuilds the whole DOM tree (see App.js render()), so an
// already-loaded avatar gets a brand-new <img> element on every unrelated
// re-render — without this cache, that would flash the skeleton again each
// time, even though the browser already has the image and loads it near-
// instantly. Checking this cache lets an already-seen image skip the
// skeleton entirely, while one still genuinely in flight keeps showing it
// uninterrupted until its own load/error event fires.
const loadedSrcs = new Set();

// Generic skeleton placeholder — use for ANY loading shape (list rows, text
// lines, cards), not just images. Give it real dimensions via style.
// e.g. Skeleton({ style: { width: "100%", height: "60px", borderRadius: "10px" } })
export function Skeleton({ style = {} } = {}) {
  return h("div", { className: "skeleton", style: { display: "block", ...style } });
}

// Image-specific skeleton: shows the shimmer placeholder until the real
// image has fully loaded, then swaps to it — and skips the shimmer
// entirely on repeat mounts of a URL that's already loaded successfully.
export function SkeletonImage({ src, alt = "", size = 64, radius = "50%" }) {
  const alreadyLoaded = loadedSrcs.has(src);

  const wrapper = h("div", { style: { position: "relative", width: `${size}px`, height: `${size}px`, flexShrink: "0", borderRadius: radius } });

  const skeleton = h("div", {
    className: "skeleton",
    style: { position: "absolute", inset: "0", borderRadius: radius, display: alreadyLoaded ? "none" : "block" },
  });

  const img = h("img", {
    src,
    alt,
    style: {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      borderRadius: radius,
      opacity: alreadyLoaded ? "1" : "0",
      transition: alreadyLoaded ? "none" : "opacity 0.2s ease",
    },
    onLoad: () => {
      loadedSrcs.add(src);
      img.style.opacity = "1";
      skeleton.style.display = "none";
    },
    onError: () => {
      // fall back to a plain empty circle rather than a broken-image icon
      skeleton.style.display = "none";
    },
  });

  wrapper.appendChild(skeleton);
  wrapper.appendChild(img);
  return wrapper;
}
