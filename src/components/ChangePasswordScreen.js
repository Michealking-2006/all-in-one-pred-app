import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { showToast } from "../toast.js";
import { supabase, authErrorMessage } from "../api/supabase.js";

function row(label, autocomplete, placeholder) {
  const input = h("input", {
    type: "password", name: autocomplete, autocomplete, placeholder, minlength: "8",
    autocapitalize: "none", autocorrect: "off", spellcheck: "false", "aria-label": label,
  });
  return { input, node: h("label", { className: "form-row" }, [text("span", { className: "form-row-label" }, label), input]) };
}

function notice(onBack, message, action) {
  return h("main", { className: "screen account-form-screen" }, [
    PageHeader({ title: "Change password", onBack }),
    h("section", { className: "form-card card" }, [text("p", { className: "muted-copy" }, message), action || null]),
  ]);
}

export function ChangePasswordScreen({ onBack, authUser, onSignIn }) {
  if (!authUser) {
    return notice(onBack, "Sign in to change your password.", h("button", { type: "button", className: "primary-button", onClick: onSignIn }, "Sign in"));
  }

  const providers = authUser.app_metadata?.providers;
  if (Array.isArray(providers) && !providers.includes("email")) {
    return notice(onBack, "You signed in with Google, so this account has no Scoutwave password to change.");
  }

  const current = row("Current", "current-password", "Required");
  const next = row("New", "new-password", "At least 8 characters");
  const confirm = row("Confirm", "new-password", "Repeat new password");
  const submit = h("button", { type: "button", className: "primary-button" }, "Update password");

  async function save() {
    if (!current.input.value) return showToast("Enter your current password", "error");
    if (next.input.value.length < 8) return showToast("New password must be at least 8 characters", "error");
    if (next.input.value !== confirm.input.value) return showToast("New passwords don't match", "error");
    if (next.input.value === current.input.value) return showToast("Choose a password different from your current one", "error");

    submit.disabled = true;
    // Re-verify the current password before allowing the change.
    const check = await supabase.auth.signInWithPassword({ email: authUser.email, password: current.input.value });
    if (check.error) {
      showToast("Current password is incorrect", "error");
      submit.disabled = false;
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: next.input.value });
    if (error) {
      showToast(authErrorMessage(error), "error");
      submit.disabled = false;
      return;
    }
    showToast("Password updated", "success");
    onBack();
  }
  submit.addEventListener("click", save);
  confirm.input.addEventListener("keydown", (event) => { if (event.key === "Enter") save(); });

  return h("main", { className: "screen account-form-screen" }, [
    PageHeader({ title: "Change password", onBack }),
    h("section", { className: "form-group" }, [current.node, next.node, confirm.node]),
    text("p", { className: "form-footnote" }, "Enter your current password to confirm it's you, then choose a new one of at least 8 characters."),
    h("div", { className: "form-actions" }, [submit]),
  ]);
}
