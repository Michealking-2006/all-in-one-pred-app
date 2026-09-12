import { h, text } from "../utils/h.js";
import { SkeletonImage } from "./Skeleton.js";

function sectionLabel(label) {
  return text("div", { style: { fontSize: "11px", color: "var(--text-muted)", padding: "14px 18px 6px", textTransform: "uppercase", letterSpacing: "0.03em" } }, label);
}

function row({ icon, label, trailing, onClick, showChevron = true }) {
  return h(
    "div",
    {
      role: onClick ? "button" : undefined,
      tabindex: onClick ? "0" : undefined,
      onClick,
      style: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "13px 18px",
        borderBottom: "0.5px solid var(--border-soft)",
      },
    },
    [
      h("i", { "data-lucide": icon, "aria-hidden": "true", style: { width: "18px", height: "18px", color: "var(--text-muted)", flexShrink: "0" } }),
      text("div", { style: { flex: "1", fontSize: "14px", fontWeight: "500" } }, label),
      trailing,
      showChevron && !trailing
        ? h("i", { "data-lucide": "chevron-right", "aria-hidden": "true", style: { width: "16px", height: "16px", color: "var(--text-muted)" } })
        : null,
    ]
  );
}

function toggleSwitch(isOn, onToggle) {
  return h(
    "button",
    {
      "aria-label": "Toggle",
      "aria-pressed": isOn,
      onClick: onToggle,
      style: {
        width: "44px",
        height: "26px",
        borderRadius: "13px",
        border: "none",
        background: isOn ? "var(--accent)" : "var(--border)",
        position: "relative",
        padding: "0",
      },
    },
    [
      h("span", {
        style: {
          position: "absolute",
          top: "3px",
          left: isOn ? "21px" : "3px",
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          background: "#FFFFFF",
        },
      }),
    ]
  );
}

// props: { isVip, coins, favoritesCount, darkTheme, onToggleDarkTheme, onOpenFavorites, onRequestUpgrade, onOpenCoins, currentLanguage, onNavigate, avatarSrc }
export function ProfileScreen({ isVip, coins, favoritesCount, darkTheme, onToggleDarkTheme, onOpenFavorites, onRequestUpgrade, onOpenCoins, currentLanguage, onNavigate, avatarSrc }) {
  return h("div", { className: "screen", style: { paddingTop: "8px" } }, [
    h("div", { style: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 18px 18px" } }, [
      avatarSrc
        ? SkeletonImage({ src: avatarSrc, size: 46, radius: "50%" })
        : text(
            "div",
            {
              style: {
                width: "46px",
                height: "46px",
                borderRadius: "50%",
                background: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "16px",
                color: "var(--on-accent)",
              },
            },
            "S"
          ),
      h("div", {}, [
        text("div", { style: { fontWeight: "700", fontSize: "15px" } }, "Scout"),
        text("div", { className: "mono", style: { fontSize: "11px", color: "var(--text-muted)" } }, isVip ? "VIP MEMBER" : "FREE PLAN"),
      ]),
    ]),

    h("div", { style: { background: "var(--surface)", borderRadius: "10px", margin: "0 12px 16px", overflow: "hidden" } }, [
      row({ icon: "gem", label: "Premium", onClick: onRequestUpgrade }),
      row({ icon: "coins", label: "Coins", trailing: text("span", { className: "mono", style: { fontSize: "13px", fontWeight: "600", color: "var(--accent)" } }, coins), onClick: onOpenCoins }),
    ]),

    sectionLabel("Account"),
    h("div", { style: { background: "var(--surface)", borderRadius: "10px", margin: "0 12px 16px", overflow: "hidden" } }, [
      row({ icon: "user", label: "Edit profile", onClick: () => onNavigate("edit-profile") }),
      row({ icon: "star", label: "My favourites", trailing: text("span", { className: "mono", style: { fontSize: "13px", color: "var(--text-muted)" } }, favoritesCount), onClick: onOpenFavorites }),
      row({ icon: "key-round", label: "Change password", onClick: () => onNavigate("change-password") }),
    ]),

    sectionLabel("Menu"),
    h("div", { style: { background: "var(--surface)", borderRadius: "10px", margin: "0 12px 16px", overflow: "hidden" } }, [
      row({ icon: "newspaper", label: "News", onClick: () => onNavigate("news") }),
      row({ icon: "bell", label: "Notifications", onClick: () => onNavigate("notifications") }),
      row({ icon: "sun", label: "Dark theme", trailing: toggleSwitch(darkTheme, onToggleDarkTheme) }),
    ]),

    sectionLabel("Support"),
    h("div", { style: { background: "var(--surface)", borderRadius: "10px", margin: "0 12px 16px", overflow: "hidden" } }, [
      row({ icon: "circle-help", label: "Help centre", onClick: () => onNavigate("help-centre") }),
      row({ icon: "triangle-alert", label: "Report issue", onClick: () => onNavigate("report-issue") }),
      row({ icon: "phone", label: "Contact us", onClick: () => onNavigate("contact-us") }),
      row({ icon: "shield", label: "Privacy policy", onClick: () => onNavigate("privacy-policy") }),
      row({ icon: "file-text", label: "Terms of use", onClick: () => onNavigate("terms-of-use") }),
      row({ icon: "info", label: "About", onClick: () => onNavigate("about") }),
      row({ icon: "globe", label: "Language", trailing: text("span", { style: { fontSize: "13px", color: "var(--text-muted)" } }, currentLanguage), onClick: () => onNavigate("language") }),
    ]),

    h(
      "button",
      {
        style: {
          display: "block",
          width: "calc(100% - 24px)",
          margin: "4px 12px 20px",
          background: "var(--primary)",
          color: "#FFFFFF",
          border: "none",
          padding: "14px",
          borderRadius: "10px",
          fontWeight: "700",
          fontSize: "14px",
        },
      },
      "Login"
    ),
  ]);
}
