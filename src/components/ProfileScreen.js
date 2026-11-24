import { h, text } from "../utils/h.js";
import { SkeletonImage } from "./Skeleton.js";
import { displayNameOf } from "./EditProfileScreen.js";
import { VerifiedBadge } from "../utils/ui.js";
import { ClubTiles, ClubCrest } from "./ClubPicker.js";

const icon = (name, cls) => h("i", { "data-lucide": name, className: cls || "", "aria-hidden": "true" });
const chevron = () => icon("chevron-right", "profile-chevron");

function row({ icon: name, label, trailing, onClick }) {
 return h("button", { className: "profile-row", onClick }, [
  h("span", { className: "profile-row-icon" }, [icon(name)]),
  text("span", { className: "profile-row-label" }, label),
  trailing ? text("span", { className: "profile-trailing" }, trailing) : null,
  chevron()
 ]);
}
const group = (tone, rows, label) => [
 label ? text("div", { className: "profile-section-label" }, label) : null,
 h("section", { className: "profile-group " + tone }, rows)
];
function stat({ name, value, label, onClick, tone }) {
 return h("button", { className: "pf-stat " + tone, onClick }, [
  h("span", { className: "pf-stat-icon" }, [icon(name)]),
  text("strong", { className: "pf-stat-value" }, String(value)),
  text("small", {}, label)
 ]);
}

const THEME_LABEL = { system: "System", light: "Light", dark: "Dark" };

export function ProfileScreen({ isVip, coins, favoritesCount, onOpenFavorites, onRequestUpgrade, onOpenCoins, currentLanguage, theme, fxThemeName, clubName, club, showClubPrompt, onPickClub, onNavigate, avatarSrc, authUser, onOpenAuth, onSignOut }) {
 const status = isVip ? "VIP member" : authUser ? "Signed in" : "Guest";
 return h("main", { className: "screen profile-screen" }, [
  h("header", { className: "pf-hero" }, [
   h("div", { className: "pf-avatar-wrap" }, [
    avatarSrc ? SkeletonImage({ src: avatarSrc, size: 92, radius: "50%" }) : h("div", { className: "pf-avatar" }, [text("span", {}, (displayNameOf(authUser) || "S").trim().charAt(0).toUpperCase() || "S")]),
    h("button", { className: "pf-avatar-edit", onClick: () => onNavigate("edit-profile"), "aria-label": "Edit profile" }, [icon("pencil")])
   ]),
   h("strong", { className: "profile-name pf-name" }, [text("span", { className: "profile-name-text" }, displayNameOf(authUser)), isVip ? VerifiedBadge({ size: 20 }) : null]),
   h("span", { className: "pf-chips" }, [
    text("span", { className: "profile-plan" + (isVip ? " vip" : "") }, status),
    club ? h("span", { className: "profile-club" }, [ClubCrest(club, 16), text("span", {}, club.name)]) : null
   ])
  ]),
  h("section", { className: "pf-stats" }, [
   stat({ name: "coins", value: coins, label: "Coins", onClick: onOpenCoins, tone: "gold" }),
   stat({ name: "star", value: favoritesCount, label: "Favourites", onClick: onOpenFavorites, tone: "red" })
  ]),
  h("button", { className: "pf-premium" + (isVip ? " active" : ""), onClick: onRequestUpgrade }, [
   h("span", { className: "pf-premium-icon" }, [icon("gem")]),
   h("span", { className: "pf-premium-copy" }, [text("strong", {}, isVip ? "Premium is active" : "Upgrade to Premium"), text("small", {}, isVip ? "Manage your plan" : "Unlock every prediction")]),
   chevron()
  ]),
  !showClubPrompt ? null : h("section", { className: "club-prompt card profile-club-prompt" }, [
   h("div", { className: "club-prompt-copy" }, [text("strong", {}, "Which club do you support?"), text("p", {}, "Pick yours and the whole app wears its colours and crest.")]),
   ClubTiles({ onSelect: onPickClub, variant: "row" })
  ]),
  ...group("tone-red", [
   row({ icon: "user", label: "Edit profile", onClick: () => onNavigate("edit-profile") }),
   row({ icon: "key-round", label: "Change password", onClick: () => onNavigate("change-password") })
  ], "Account"),
  ...group("tone-red", [
   row({ icon: "calendar", label: "Match diary", onClick: () => onNavigate("diary") }),
   row({ icon: "arrow-right-left", label: "Transfers & injuries", onClick: () => onNavigate("hub") }),
   row({ icon: "sparkles", label: "Season recap", onClick: () => onNavigate("recap") })
  ], "Football"),
  ...group("tone-orange", [
   row({ icon: "bell", label: "Notifications", onClick: () => onNavigate("notifications") }),
   row({ icon: "moon", label: "Appearance", trailing: clubName || THEME_LABEL[theme] || "System", onClick: () => onNavigate("appearance") }),
   row({ icon: "palette", label: "Advanced themes", trailing: fxThemeName, onClick: () => onNavigate("themes") }),
   row({ icon: "globe", label: "Language", trailing: currentLanguage, onClick: () => onNavigate("language") })
  ], "Preferences"),
  ...group("tone-gray", [
   row({ icon: "circle-help", label: "Help centre", onClick: () => onNavigate("help-centre") }),
   row({ icon: "message-square", label: "Send feedback", onClick: () => onNavigate("feedback") }),
   row({ icon: "triangle-alert", label: "Report issue", onClick: () => onNavigate("report-issue") }),
   row({ icon: "phone", label: "Contact us", onClick: () => onNavigate("contact-us") })
  ], "Help"),
  ...group("tone-gray", [
   row({ icon: "shield", label: "Privacy policy", onClick: () => onNavigate("privacy-policy") }),
   row({ icon: "file-text", label: "Terms of use", onClick: () => onNavigate("terms-of-use") }),
   row({ icon: "info", label: "About", onClick: () => onNavigate("about") })
  ]),
  h("button", { className: "profile-login" + (authUser ? " signout" : ""), onClick: authUser ? onSignOut : onOpenAuth }, [text("span", {}, authUser ? "Sign out" : "Log in or create account")])
 ]);
}
