import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { showToast } from "../toast.js";
import { SUPPORT_EMAIL, APP_VERSION } from "../config.js";

const ISSUE_TYPES = ["Bug or crash", "Incorrect data or odds", "Payment or coins issue", "Something else"];

// No backend for reports yet, so this opens the user's mail app with the report
// pre-filled (type, description, app version, browser) addressed to support.
export function ReportIssueScreen({ onBack }) {
  const type = h("select", {}, ISSUE_TYPES.map((v) => text("option", {}, v)));
  const details = h("textarea", { rows: "6", placeholder: "What happened, and what did you expect instead?" });

  function submit() {
    const description = details.value.trim();
    if (description.length < 10) {
      showToast("Please describe the issue in a little more detail", "error");
      return;
    }
    const body = description + "\n\n---\nApp version: " + APP_VERSION + "\nBrowser: " + navigator.userAgent;
    window.location.href = "mailto:" + SUPPORT_EMAIL + "?subject=" + encodeURIComponent("Scoutwave issue: " + type.value) + "&body=" + encodeURIComponent(body);
    showToast("Opening your email app\u2026");
  }

  return h("main", { className: "screen account-form-screen" }, [
    PageHeader({ title: "Report an issue", onBack }),
    h("section", { className: "form-card card" }, [
      h("label", { className: "form-field" }, [text("span", { className: "form-field-label" }, "Issue type"), type]),
      h("label", { className: "form-field" }, [text("span", { className: "form-field-label" }, "Describe the issue"), details]),
      h("button", { type: "button", className: "primary-button", onClick: submit }, "Send report"),
    ]),
  ]);
}
