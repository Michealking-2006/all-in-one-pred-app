import { h } from "../utils/h.js";
import { PageHeader, formField } from "./PageHeader.js";

// props: { onBack }
export function ChangePasswordScreen({ onBack }) {
  return h("div", { className: "screen" }, [
    PageHeader({ title: "Change password", onBack }),
    h("div", { style: { padding: "20px 18px" } }, [
      formField("Current password", { type: "password" }),
      formField("New password", { type: "password" }),
      formField("Confirm new password", { type: "password" }),
      h(
        "button",
        {
          onClick: onBack,
          style: { width: "100%", background: "var(--primary)", color: "#FFFFFF", border: "none", padding: "13px", borderRadius: "8px", fontWeight: "700", fontSize: "14px", marginTop: "6px" },
        },
        "Update password"
      ),
    ]),
  ]);
}
