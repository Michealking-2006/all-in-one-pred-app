import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { SUPPORT_EMAIL, SOCIAL_LINKS } from "../config.js";

export function ContactUsScreen({ onBack }) {
  const contacts = [
    { icon: "mail", label: "Email", value: SUPPORT_EMAIL, href: "mailto:" + SUPPORT_EMAIL },
    { icon: "twitter", label: "X", value: SOCIAL_LINKS.x, href: SOCIAL_LINKS.x, external: true },
    { icon: "instagram", label: "Instagram", value: SOCIAL_LINKS.instagram, href: SOCIAL_LINKS.instagram, external: true },
  ].filter((c) => c.href);

  return h("main", { className: "screen info-screen" }, [
    PageHeader({ title: "Contact us", onBack }),
    h("section", { className: "contact-list card" }, contacts.map((c) =>
      h("a", { className: "contact-row", href: c.href, ...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {}) }, [
        h("span", { className: "contact-icon" }, [h("i", { "data-lucide": c.icon })]),
        h("span", { className: "contact-copy" }, [text("small", {}, c.label), text("strong", {}, c.value.replace(/^https?:\/\/(www\.)?/, "").replace(/^mailto:/, ""))]),
        h("i", { className: "profile-chevron", "data-lucide": "arrow-up-right" }),
      ])
    )),
  ]);
}
