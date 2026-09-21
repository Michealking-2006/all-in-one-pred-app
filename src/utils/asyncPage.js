import { h, text } from "./h.js";
import { PageHeader } from "../components/PageHeader.js";
import { Skeleton } from "../components/Skeleton.js";

export function createAsyncPage({ title, onBack, fetchData, renderBody, notFoundMessage = "Not found." }) {
  const container = h("main", { className: "screen async-detail-screen" });
  container.appendChild(PageHeader({ title, onBack }));

  const body = h("div", { className: "async-page-body" });
  container.appendChild(body);
  body.appendChild(h("div", { className: "async-loading-state" }, [
    Skeleton({ style: { width: "64px", height: "64px", borderRadius: "12px" } }),
    Skeleton({ style: { width: "150px", height: "16px", borderRadius: "4px" } }),
    Skeleton({ style: { width: "100px", height: "11px", borderRadius: "4px" } }),
  ]));

  fetchData().then((result) => {
    body.innerHTML = "";
    if (!result) {
      body.appendChild(text("div", { className: "async-empty-state" }, notFoundMessage));
      return;
    }
    renderBody(body, result);
  }).catch((err) => {
    body.innerHTML = "";
    body.appendChild(text("div", { className: "async-error-state" }, err.message || "Couldn't load — check your connection."));
  });

  return container;
}
