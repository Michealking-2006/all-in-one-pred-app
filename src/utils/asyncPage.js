import { h, text } from "./h.js";
import { PageHeader } from "../components/PageHeader.js";
import { skeletonFor } from "../components/Skeleton.js";

export function createAsyncPage({ title, onBack, fetchData, renderBody, notFoundMessage = "Not found.", action = null }) {
  const container = h("main", { className: "screen async-detail-screen" });
  container.appendChild(PageHeader({ title, onBack, action }));

  const body = h("div", { className: "async-page-body" });
  container.appendChild(body);
  body.setAttribute("aria-busy", "true");
  body.appendChild(skeletonFor("overview"));

  fetchData().then((result) => {
    body.innerHTML = "";
    body.removeAttribute("aria-busy");
    if (!result) {
      body.appendChild(text("div", { className: "async-empty-state" }, notFoundMessage));
      return;
    }
    renderBody(body, result);
  }).catch((err) => {
    body.innerHTML = "";
    body.removeAttribute("aria-busy");
    body.appendChild(text("div", { className: "async-error-state" }, err.message || "Couldn't load — check your connection."));
  });

  return container;
}
