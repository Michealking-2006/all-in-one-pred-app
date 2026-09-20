import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { showToast } from "../toast.js";
import { supabase, authErrorMessage } from "../api/supabase.js";

function field(label, autocomplete) {
  const input = h("input", { type: "password", autocomplete, minlength: "8" });
  return { input, node: h("label", { className: "form-field" }, [text("span", { className: "form-field-label" }, label), input]) };
}

export function ChangePasswordScreen({ onBack, authUser, onSignIn }) {
  if (!authUser) {
    return h("main", { className: "screen account-form-screen" }, [
      PageHeader({ title: "Change password", onBack }),
      h("section", { className: "form-card card" }, [
        text("p", { className: "muted-copy" }, "Sign in to change your password."),
        h("button", { className: "primary-button", onClick: onSignIn }, "Sign in"),
      ]),
    ]);
  }

  const providers = authUser.app_metadata?.providers;
  if (Array.isArray(providers) && !providers.includes("email")) {
    return h("main", { className: "screen account-form-screen" }, [
      PageHeader({ title: "Change password", onBack }),
      h("section", { className: "form-card card" }, [
        text("p", { className: "muted-copy" }, "You signed in with Google, so this account has no Scoutwave password to change."),
      ]),
    ]);
  }

  const current = field("Current password", "current-password");
  const next = field("New password", "new-password");
  const confirm = field("Confirm new password", "new-password");
  const submit = h("button", { type: "button", className: "primary-button" }, "Update password");

  submit.addEventListener("click", async () => {
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
  });

  return h("main", { className: "screen account-form-screen" }, [
    PageHeader({ title: "Change password", onBack }),
    h("section", { className: "form-card card" }, [current.node, next.node, confirm.node, submit]),
  ]);
}
