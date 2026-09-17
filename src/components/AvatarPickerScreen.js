import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { SkeletonImage } from "./Skeleton.js";
import { avatars } from "../data/avatars.js";

// props: { current, onSelect, onBack }
export function AvatarPickerScreen({ current, onSelect, onBack }) {
  return h("div", { className: "screen" }, [
    PageHeader({ title: "Choose an avatar", onBack }),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", padding: "20px 18px" } }, [
      ...avatars.map((a) => {
        const isSelected = a.id === current;
        const avatarImg = SkeletonImage({ src: a.src, alt: a.label, size: 64, radius: "50%" });
        if (isSelected) avatarImg.style.boxShadow = "0 0 0 3px var(--accent)";
        return h(
          "button",
          {
            "aria-label": `Select ${a.label}`,
            "aria-pressed": isSelected,
            onClick: () => onSelect(a.id),
            style: { border: "none", background: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "0" },
          },
          [avatarImg, text("span", { style: { fontSize: "11px", color: "var(--text-muted)" } }, a.label)]
        );
      }),
    ]),
  ]);
}
