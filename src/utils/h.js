// h(tag, props, children) builds a real DOM node declaratively,
// the same shape as React.createElement(tag, props, children).
// Props starting with "on" become addEventListener calls.
// "style" accepts an object. Everything else is setAttribute.
//
// Special case: h("i", { "data-lucide": "name", ... }) transparently renders
// an inline SVG icon instead of a plain <i> element — every call site across
// the app already uses this exact shape (a leftover convention from when
// icons were swapped in later by a CDN script), so intercepting it here means
// zero call sites needed to change when that CDN dependency was removed.
import { safeUrl } from "./safeUrl.js";

// Attributes that load or navigate to a URL, and ones that can run code or inject markup.
// Values from outside the app can end up in any of these, so they are checked here, once, for every
// element in the app. Event handlers must be functions: a string on* attribute is dropped.
const URL_ATTRS = new Set(["href", "src", "action", "formaction", "poster", "xlink:href", "data", "cite", "background"]);
const NEVER_ATTRS = new Set(["srcdoc", "srcset", "innerhtml", "outerhtml", "formmethod", "http-equiv"]);

export function h(tag, props = {}, children = []) {
  if (tag === "i" && props && Object.prototype.hasOwnProperty.call(props, "data-lucide")) {
    const { "data-lucide": name, style = {}, color: explicitColor, fill, ...rest } = props;
    const { width, height, color: styleColor, ...restStyle } = style;
    const size = width ? parseInt(width, 10) : height ? parseInt(height, 10) : 18;
    return Icon(name, { size, color: explicitColor || styleColor || "currentColor", fill, style: restStyle, ...rest });
  }

  // SVG elements are a different namespace from HTML — document.createElement
  // silently produces an inert, non-rendering element for them (this was the
  // actual bug that made every icon disappear after the CDN removal: the
  // "svg" root Icon() builds via h() was being created as a plain HTML
  // element, so it never rendered any graphics at all).
  const SVG_TAGS = new Set(["svg", "path", "circle", "rect", "line", "polygon", "polyline", "g", "defs", "text", "title"]);
  const el = SVG_TAGS.has(tag) ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);

  Object.entries(props || {}).forEach(([key, value]) => {
    if (value == null) return;
    const lower = key.toLowerCase();
    if (lower.startsWith("on") && typeof value !== "function") return; // a string handler would be code
    if (NEVER_ATTRS.has(lower) || (lower === "style" && typeof value === "string")) return;
    if (URL_ATTRS.has(lower) && typeof value === "string") {
      const clean = safeUrl(value, { image: lower === "src" || lower === "poster" });
      if (!clean) return; // unsafe or empty: leave the attribute off rather than render it
      el.setAttribute(key, clean);
      return;
    }
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "style" && typeof value === "object") {
      // Custom properties ("--n") only work through setProperty; plain assignment ignores them.
      for (const [name, v] of Object.entries(value)) { if (name.startsWith("--")) el.style.setProperty(name, String(v)); else el.style[name] = v; }
    } else if (key === "className") {
      el.setAttribute("class", value);
    } else if (key === "dataset" && typeof value === "object") {
      Object.entries(value).forEach(([dk, dv]) => (el.dataset[dk] = dv));
    } else if (typeof value === "boolean") {
      if (key.startsWith("aria-")) {
        // ARIA states are string enums ("true"/"false"), not presence-based
        el.setAttribute(key, String(value));
      } else if (value) {
        // boolean HTML attributes (disabled, checked, etc.) are presence-based:
        // setAttribute("disabled", false) still disables the element, so skip entirely when false
        el.setAttribute(key, "");
      }
    } else {
      el.setAttribute(key, value);
    }
  });

  // A link that opens a new tab must not hand that tab a way back to ours.
  if (tag === "a" && el.getAttribute("target") === "_blank") {
    const rel = new Set((el.getAttribute("rel") || "").split(/\s+/).filter(Boolean)); // keep e.g. "sponsored", always add the two that matter
    rel.add("noopener"); rel.add("noreferrer");
    el.setAttribute("rel", [...rel].join(" "));
  }

  // Decode images off the main thread: smoother scrolling through long match lists.
  if (tag === "img" && !el.hasAttribute("decoding")) el.setAttribute("decoding", "async");

  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child == null || child === false) return;
    el.appendChild(typeof child === "string" || typeof child === "number" ? document.createTextNode(child) : child);
  });

  return el;
}

// Small helper for text-only leaf nodes, avoids repeating h("span", {}, [text]) everywhere
export function text(tag, props, str) {
  return h(tag, props, [str == null ? "" : String(str)]);
}

// Imported at the bottom, not the top — icons.js imports `h` from this same
// file. Both directions are safe here because `h` and `Icon` are hoisted
// function declarations, and neither runs the other at module-load time,
// only later when something actually calls them.
import { Icon } from "./icons.js";
