import { h } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { buildSupportForm } from "./SupportForm.js";

const ISSUE_TYPES = ["Bug or crash", "Incorrect data or odds", "Payment or coins issue", "Something else"];

export function ReportIssueScreen({ onBack, authUser }) {
  return h("main", { className: "screen account-form-screen" }, [
    PageHeader({ title: "Report an issue", onBack }),
    buildSupportForm({
      kind: "issue", types: ISSUE_TYPES, typeLabel: "Type", authUser,
      placeholder: "What happened, and what did you expect instead?",
      submitLabel: "Send report",
      successTitle: "Report received",
      successBody: "Thanks for letting us know. We read every report and will look into it.",
      onDone: onBack,
    }),
  ]);
}
