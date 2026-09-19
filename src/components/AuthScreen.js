import { h, text } from "../utils/h.js";
import { supabase, authErrorMessage } from "../api/supabase.js";
import { navigate } from "../router.js";

export function AuthScreen({ mode = "login" } = {}) {
  const container = h("main", { className: "screen auth-screen" });
  let currentMode = mode;
  const card = h("section", { className: "auth-card" });
  const title = text("h1", {}, "");
  const subtitle = text("p", { className: "auth-subtitle" }, "");
  const form = h("form", { className: "auth-form" });
  const email = h("input", { type: "email", autocomplete: "email", placeholder: "Email address", required: true });
  const password = h("input", { type: "password", autocomplete: "current-password", placeholder: "Password", minlength: "8" });
  const submit = h("button", { className: "primary-button auth-submit", type: "submit" });
  const message = h("div", { className: "auth-message", role: "status", "aria-live": "polite" });
  const footer = h("div", { className: "auth-footer" });

  function renderMode() {
    title.textContent = currentMode === "signup" ? "Create your account" : currentMode === "reset" ? "Reset your password" : "Welcome back";
    subtitle.textContent = currentMode === "signup" ? "Save favourites, follow clubs and keep your football profile with you." : currentMode === "reset" ? "Enter your email and we'll send you a password reset link." : "Sign in to save your favourites and personalize Scoutwave.";
    submit.textContent = currentMode === "signup" ? "Create account" : currentMode === "reset" ? "Send reset link" : "Sign in";
    password.style.display = currentMode === "reset" ? "none" : "";
    password.required = currentMode !== "reset";
    footer.innerHTML = "";
    if (currentMode === "login") {
      footer.append(
        h("button", { type:"button", className:"auth-link", onClick:()=>navigate("/auth/signup") }, "Create an account"),
        h("button", { type:"button", className:"auth-link", onClick:()=>navigate("/auth/reset") }, "Forgot password?")
      );
    } else {
      footer.append(h("button", { type:"button", className:"auth-link", onClick:()=>navigate("/auth") }, "Back to sign in"));
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    message.textContent = "";
    message.classList.remove("is-error");
    try {
      if (currentMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.value.trim(), password: password.value,
          options: { emailRedirectTo: window.location.origin + "/auth" }
        });
        if (error) throw error;
        message.textContent = data.session ? "Account created. Welcome to Scoutwave." : "Account created. Check your email to confirm your account.";
        if (data.session) navigate("/");
      } else if (currentMode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: window.location.origin + "/auth" });
        if (error) throw error;
        message.textContent = "Password reset instructions have been sent to your email.";
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
        if (error) throw error;
        navigate("/");
      }
    } catch (error) {
      message.textContent = authErrorMessage(error);
      message.classList.add("is-error");
    } finally { submit.disabled = false; }
  });

  card.append(title, subtitle, form, message, footer);
  form.append(email, password, submit);
  container.appendChild(card);
  renderMode();
  return container;
}
