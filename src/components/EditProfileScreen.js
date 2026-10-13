import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { SkeletonImage } from "./Skeleton.js";
import { showToast } from "../toast.js";
import { authErrorMessage } from "../api/supabase.js";

export function displayNameOf(authUser) {
  return authUser?.user_metadata?.full_name || (authUser?.email ? authUser.email.split("@")[0] : "Scout");
}

export function EditProfileScreen({ onBack, avatarSrc, onChooseAvatar, authUser, onSaveName, onSignIn }) {
  const avatarSection = h("section", { className: "avatar-editor" }, [
    h("button", { type: "button", className: "avatar-editor-button", onClick: onChooseAvatar, "aria-label": "Choose an avatar" }, [
      avatarSrc ? SkeletonImage({ src: avatarSrc, size: 84, radius: "50%" }) : text("span", { className: "avatar-editor-fallback" }, "S"),
    ]),
    h("button", { type: "button", className: "text-action", onClick: onChooseAvatar }, "Change avatar"),
  ]);

  if (!authUser) {
    return h("main", { className: "screen account-form-screen" }, [
      PageHeader({ title: "Edit profile", onBack }),
      avatarSection,
      h("section", { className: "form-card card" }, [
        text("p", { className: "muted-copy" }, "Sign in to set a display name and manage your account."),
        h("button", { type: "button", className: "primary-button", onClick: onSignIn }, "Sign in"),
      ]),
    ]);
  }

  const name = h("input", { type: "text", name: "name", value: displayNameOf(authUser), maxlength: "40", autocomplete: "name", enterkeyhint: "done", "aria-label": "Display name" });
  const email = h("input", { type: "email", name: "email", value: authUser.email || "", disabled: true, "aria-label": "Email" });
  const save = h("button", { type: "button", className: "primary-button" }, "Save changes");

  async function submit() {
    const value = name.value.trim();
    if (!value) {
      showToast("Display name can't be empty", "error");
      return;
    }
    save.disabled = true;
    try {
      await onSaveName(value);
      showToast("Profile updated", "success");
      onBack();
    } catch (error) {
      showToast(authErrorMessage(error), "error");
      save.disabled = false;
    }
  }
  save.addEventListener("click", submit);
  name.addEventListener("keydown", (event) => { if (event.key === "Enter") submit(); });

  return h("main", { className: "screen account-form-screen" }, [
    PageHeader({ title: "Edit profile", onBack }),
    avatarSection,
    h("section", { className: "form-group" }, [
      h("label", { className: "form-row" }, [text("span", { className: "form-row-label" }, "Name"), name]),
      h("label", { className: "form-row is-readonly" }, [text("span", { className: "form-row-label" }, "Email"), email]),
    ]),
    text("p", { className: "form-footnote" }, "Your name appears on your profile. Your email is used to sign in and can't be changed here."),
    h("div", { className: "form-actions" }, [save]),
  ]);
}
