import { h, text } from "../utils/h.js";
import { supabase, authErrorMessage } from "../api/supabase.js";
import { navigate } from "../router.js";
import { showToast } from "../toast.js";

const MODE_COPY = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to save your favourites and personalize Scoutwave.",
    submit: "Sign in",
  },
  signup: {
    title: "Create your account",
    subtitle: "Save favourites, follow clubs and keep your football profile with you.",
    submit: "Create account",
  },
  reset: {
    title: "Reset your password",
    subtitle: "Enter your email and we'll send you a password reset link.",
    submit: "Send reset link",
  },
  update: {
    title: "Set a new password",
    subtitle: "Choose a new password for your Scoutwave account.",
    submit: "Update password",
  },
};

export function AuthScreen({ mode = "login" } = {}) {
  const currentMode = MODE_COPY[mode] ? mode : "login";
  const copy = MODE_COPY[currentMode];
  const isUpdate = currentMode === "update";
  const isReset = currentMode === "reset";

  const container = h("main", { className: "screen auth-screen" });
  const card = h("section", { className: "auth-card" });
  const title = text("h1", {}, copy.title);
  const subtitle = text("p", { className: "auth-subtitle" }, copy.subtitle);
  const form = h("form", { className: "auth-form" });
  const googleButton = h("button", { type: "button", className: "google-auth-button" }, [
    h("span", { className: "google-auth-mark", "aria-hidden": "true" }, "G"),
    h("span", {}, "Continue with Google"),
  ]);
  const divider = h("div", { className: "auth-divider", "aria-hidden": "true" }, [h("span", {}, "or")]);
  const email = h("input", { type: "email", autocomplete: "email", placeholder: "Email address", required: !isUpdate });
  const password = h("input", {
    type: "password",
    autocomplete: currentMode === "login" ? "current-password" : "new-password",
    placeholder: isUpdate ? "New password" : "Password",
    minlength: "8",
    required: !isReset,
  });
  const confirm = h("input", { type: "password", autocomplete: "new-password", placeholder: "Confirm new password", minlength: "8", required: isUpdate });
  const submit = h("button", { className: "primary-button auth-submit", type: "submit" }, copy.submit);
  const message = h("div", { className: "auth-message", role: "status", "aria-live": "polite" });
  const footer = h("div", { className: "auth-footer" });

  if (isUpdate || isReset) {
    googleButton.style.display = "none";
    divider.style.display = "none";
  }
  if (isUpdate) email.style.display = "none";
  if (isReset) password.style.display = "none";
  if (!isUpdate) confirm.style.display = "none";

  function fail(error) {
    message.textContent = authErrorMessage(error);
    message.classList.add("is-error");
  }

  googleButton.addEventListener("click", async () => {
    googleButton.disabled = true;
    message.textContent = "";
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth" },
      });
      if (error) throw error;
    } catch (error) {
      fail(error);
      googleButton.disabled = false;
    }
  });

  if (currentMode === "login") {
    footer.append(
      h("button", { type: "button", className: "auth-link", onClick: () => navigate("/auth/signup") }, "Create an account"),
      h("button", { type: "button", className: "auth-link", onClick: () => navigate("/auth/reset") }, "Forgot password?")
    );
  } else if (isUpdate) {
    footer.append(h("button", { type: "button", className: "auth-link", onClick: () => navigate("/") }, "Skip for now"));
  } else {
    footer.append(h("button", { type: "button", className: "auth-link", onClick: () => navigate("/auth") }, "Back to sign in"));
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    message.textContent = "";
    message.classList.remove("is-error");
    try {
      if (currentMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.value.trim(),
          password: password.value,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) throw error;
        if (data.session) navigate("/");
        else message.textContent = "Account created. Check your email to confirm your account.";
      } else if (isReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: window.location.origin + "/auth" });
        if (error) throw error;
        message.textContent = "Password reset instructions have been sent to your email.";
      } else if (isUpdate) {
        if (password.value !== confirm.value) throw new Error("The two passwords don't match.");
        const { error } = await supabase.auth.updateUser({ password: password.value });
        if (error) throw error;
        showToast("Password updated", "success");
        navigate("/", { replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
        if (error) throw error;
        navigate("/");
      }
    } catch (error) {
      fail(error);
    } finally {
      submit.disabled = false;
    }
  });

  card.append(title, subtitle, googleButton, divider, form, message, footer);
  form.append(email, password, confirm, submit);
  container.appendChild(card);
  return container;
}
