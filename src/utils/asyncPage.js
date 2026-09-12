import { h, text } from "./h.js";
import { PageHeader } from "../components/PageHeader.js";
import { Skeleton } from "../components/Skeleton.js";

// Deliberately imperative, not store-driven — a detail page only needs to
// repaint itself once when its single fetch resolves. Routing that through
// the global store would trigger a full app re-render for no benefit, the
// same reasoning documented in toast.js and LeaguesScreen.js.
export function createAsyncPage({ title, onBack, fetchData, renderBody, notFoundMessage = "Not found." }) {
  const container = h("div", { className: "screen" });
  container.appendChild(PageHeader({ title, onBack }));

  const body = h("div", { style: { padding: "24px 18px" } });
  container.appendChild(body);

  body.appendChild(
    h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" } }, [
      Skeleton({ style: { width: "64px", height: "64px", borderRadius: "12px" } }),
      Skeleton({ style: { width: "150px", height: "16px", borderRadius: "4px" } }),
      Skeleton({ style: { width: "100px", height: "11px", borderRadius: "4px" } }),
    ])
  );

  fetchData()
    .then((result) => {
      body.innerHTML = "";
      if (!result) {
        body.appendChild(text("div", { style: { textAlign: "center", color: "var(--text-muted)", fontSize: "13px", padding: "30px 0" } }, notFoundMessage));
        return;
      }
      renderBody(body, result);
    })
    .catch(() => {
      body.innerHTML = "";
      body.appendChild(text("div", { style: { textAlign: "center", color: "var(--danger)", fontSize: "13px", padding: "30px 0" } }, "Couldn't load \u2014 check your connection."));
    });

  return container;
}
