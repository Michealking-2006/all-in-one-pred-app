import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";

const CONTACTS = [
  { icon: "mail", label: "Email", value: "support@scoutwave.app", href: "mailto:support@scoutwave.app" },
  { icon: "phone", label: "Phone", value: "+1 (555) 010-2938", href: "tel:+15550102938" },
  { icon: "twitter", label: "X (Twitter)", value: "@scoutwave", href: "#" },
  { icon: "instagram", label: "Instagram", value: "@scoutwave", href: "#" },
];

// props: { onBack }
export function ContactUsScreen({ onBack }) {
  return h("div", { className: "screen" }, [
    PageHeader({ title: "Contact us", onBack }),
    ...CONTACTS.map((c) =>
      h("a", { href: c.href, style: { display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", borderBottom: "0.5px solid var(--border-soft)", textDecoration: "none", color: "var(--text)" } }, [
        h("i", { "data-lucide": c.icon, "aria-hidden": "true", style: { width: "18px", height: "18px", color: "var(--text-muted)" } }),
        h("div", {}, [
          text("div", { style: { fontSize: "11px", color: "var(--text-muted)" } }, c.label),
          text("div", { style: { fontSize: "14px", fontWeight: "500" } }, c.value),
        ]),
      ])
    ),
  ]);
}
