// h(tag, props, children) builds a real DOM node declaratively,
// the same shape as React.createElement(tag, props, children).
// Props starting with "on" become addEventListener calls.
// "style" accepts an object. Everything else is setAttribute.
export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);

  Object.entries(props || {}).forEach(([key, value]) => {
    if (value == null) return;
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "style" && typeof value === "object") {
      Object.assign(el.style, value);
    } else if (key === "className") {
      el.setAttribute("class", value);
    } else if (key === "dataset" && typeof value === "object") {
      Object.entries(value).forEach(([dk, dv]) => (el.dataset[dk] = dv));
    } else if (typeof value === "boolean") {
      // boolean HTML attributes (disabled, checked, etc.) are presence-based:
      // setAttribute("disabled", false) still disables the element, so skip entirely when false
      if (value) el.setAttribute(key, "");
    } else {
      el.setAttribute(key, value);
    }
  });

  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child == null || child === false) return;
    el.appendChild(typeof child === "string" || typeof child === "number" ? document.createTextNode(child) : child);
  });

  return el;
}

// Small helper for text-only leaf nodes, avoids repeating h("span", {}, [text]) everywhere
export function text(tag, props, str) {
  return h(tag, props, [String(str)]);
}
