import { h, text } from "../utils/h.js";
import { PageHeader, formField } from "./PageHeader.js";

// props: { onBack }
export function ReportIssueScreen({ onBack }) {
  return h("div", { className: "screen" }, [
    PageHeader({ title: "Report an issue", onBack }),
    h("div", { style: { padding: "20px 18px" } }, [
      h("label", { style: { display: "block", marginBottom: "14px" } }, [
        text("div", { style: { fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" } }, "Issue type"),
        h("select", {}, [
          text("option", {}, "Bug or crash"),
          text("option", {}, "Incorrect odds"),
          text("option", {}, "Payment or coins issue"),
          text("option", {}, "Something else"),
        ]),
      ]),
      formField("Describe the issue", { tag: "textarea", placeholder: "What happened, and what did you expect instead?" }),
      h(
        "button",
        {
          onClick: onBack,
          style: { width: "100%", background: "var(--primary)", color: "#FFFFFF", border: "none", padding: "13px", borderRadius: "8px", fontWeight: "700", fontSize: "14px", marginTop: "6px" },
        },
        "Submit report"
      ),
    ]),
  ]);
}
