import { h, text } from "../utils/h.js";
import { PageHeader, formField } from "./PageHeader.js";
import { SkeletonImage } from "./Skeleton.js";

// props: { onBack, avatarSrc, onChooseAvatar }
export function EditProfileScreen({ onBack, avatarSrc, onChooseAvatar }) {
  return h("div", { className: "screen" }, [
    PageHeader({ title: "Edit profile", onBack }),
    h("div", { style: { padding: "20px 18px" } }, [
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "22px" } }, [
        h(
          "button",
          {
            "aria-label": "Choose an avatar",
            onClick: onChooseAvatar,
            style: { border: "none", background: "none", padding: "0", marginBottom: "10px" },
          },
          [
            avatarSrc
              ? SkeletonImage({ src: avatarSrc, size: 72, radius: "50%" })
              : text(
                  "div",
                  {
                    style: {
                      width: "72px",
                      height: "72px",
                      borderRadius: "50%",
                      background: "var(--accent)",
                      color: "var(--on-accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "700",
                      fontSize: "26px",
                    },
                  },
                  "S"
                ),
          ]
        ),
        text("button", { onClick: onChooseAvatar, style: { border: "none", background: "none", color: "var(--accent)", fontSize: "13px", fontWeight: "600", padding: "0" } }, "Change avatar"),
      ]),
      formField("Display name", { value: "Scout" }),
      formField("Email", { type: "email", value: "scout@example.com" }),
      h(
        "button",
        {
          onClick: onBack,
          style: { width: "100%", background: "var(--primary)", color: "#FFFFFF", border: "none", padding: "13px", borderRadius: "8px", fontWeight: "700", fontSize: "14px", marginTop: "6px" },
        },
        "Save changes"
      ),
    ]),
  ]);
}
