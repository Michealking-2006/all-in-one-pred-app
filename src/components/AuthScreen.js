import { h, text } from "../utils/h.js";
import { supabase, authErrorMessage } from "../api/supabase.js";
import { navigate, goBack } from "../router.js";
import { showToast } from "../toast.js";

const MODE_COPY = {
  login: { title: "Welcome back", subtitle: "Sign in to sync your favourites and personalise Scoutwave.", submit: "Sign in" },
  signup: { title: "Create your account", subtitle: "Follow clubs, save matches and keep your football profile with you.", submit: "Create account" },
  reset: { title: "Reset password", subtitle: "Enter your email and we'll send you a link to choose a new password.", submit: "Send reset link" },
  update: { title: "New password", subtitle: "Choose a strong password you haven't used before.", submit: "Update password" },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_SECONDS = 30;

// 0 = too short, 1..4 = weak..strong. Rewards length and variety of character
// classes; a common shape like "Password1234" lands at "Good", not "Strong".
function passwordStrength(value) {
  const length = value.length;
  if (length < 8) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
  let score = 1;
  if (classes >= 2) score++;
  if (classes >= 3 && length >= 10) score++;
  if ((classes === 4 && length >= 12) || (classes >= 3 && length >= 16)) score++;
  return Math.min(score, 4);
}
const STRENGTH_LABEL = ["Use at least 8 characters", "Weak", "Fair", "Good", "Strong"];

function passwordField({ placeholder, autocomplete, name }) {
  const input = h("input", {
    type: "password", name, placeholder, autocomplete, minlength: "8",
    autocapitalize: "none", autocorrect: "off", spellcheck: "false", enterkeyhint: "go", "aria-label": placeholder,
  });
  const eye = h("button", { type: "button", className: "auth-eye", "aria-label": "Show password", "aria-pressed": false }, [h("i", { "data-lucide": "eye" })]);
  const root = h("label", { className: "auth-field" }, [h("i", { "data-lucide": "lock" }), input, eye]);
  eye.addEventListener("click", (event) => {
    event.preventDefault();
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    eye.setAttribute("aria-pressed", String(show));
    eye.setAttribute("aria-label", show ? "Hide password" : "Show password");
    eye.replaceChildren(h("i", { "data-lucide": show ? "eye-off" : "eye" }));
    input.focus();
  });
  return { root, input };
}

export function AuthScreen({ mode = "login" } = {}) {
  const currentMode = MODE_COPY[mode] ? mode : "login";
  const copy = MODE_COPY[currentMode];
  const isLogin = currentMode === "login";
  const isSignup = currentMode === "signup";
  const isReset = currentMode === "reset";
  const isUpdate = currentMode === "update";
  const wantsNewPassword = isSignup || isUpdate;

  // ---- Chrome ---------------------------------------------------------------
  const showBack = isSignup || isReset;
  const showSkip = isLogin || isUpdate;
  const topbar = h("div", { className: "auth-topbar" }, [
    showBack
      ? h("button", { type: "button", className: "back-button", "aria-label": "Back", onClick: () => goBack("/auth") }, [
          h("i", { "data-lucide": "chevron-left", "aria-hidden": "true" }), text("span", {}, "Back"),
        ])
      : h("span", {}),
    showSkip ? h("button", { type: "button", className: "auth-skip", onClick: () => navigate("/", { replace: isUpdate }) }, "Skip") : null,
  ]);

  const brand = h("div", { className: "auth-brand" }, [h("div", { className: "auth-mark" }, [h("img", { src: "/src/assets/scoutwave-mark-white.png", alt: "Scoutwave" })])]);
  const title = text("h1", { className: "auth-title" }, copy.title);
  const subtitle = text("p", { className: "auth-subtitle" }, copy.subtitle);

  // ---- Form pieces ------------------------------------------------------------
  const googleButton = h("button", { type: "button", className: "google-auth-button" }, [h("i", { "data-lucide": "google", "aria-hidden": "true" }), h("span", {}, "Continue with Google")]);
  const divider = h("div", { className: "auth-divider", "aria-hidden": "true" }, [h("span", {}, "or")]);

  const emailInput = h("input", {
    type: "email", name: "email", placeholder: "Email", autocomplete: "email", inputmode: "email",
    autocapitalize: "none", autocorrect: "off", spellcheck: "false", enterkeyhint: isReset ? "go" : "next", "aria-label": "Email address",
  });
  const emailField = h("label", { className: "auth-field" }, [h("i", { "data-lucide": "mail" }), emailInput]);
  const passwordCtl = passwordField({
    name: "password", placeholder: isUpdate ? "New password" : "Password",
    autocomplete: isLogin ? "current-password" : "new-password",
  });
  const confirmCtl = passwordField({ name: "confirm", placeholder: "Confirm new password", autocomplete: "new-password" });

  const strengthBars = h("div", { className: "auth-strength-bars" }, [h("span"), h("span"), h("span"), h("span")]);
  const strengthLabel = text("span", { className: "auth-strength-label" }, STRENGTH_LABEL[0]);
  const strength = h("div", { className: "auth-strength", "data-level": "0" }, [strengthBars, strengthLabel]);
  const matchHint = h("div", { className: "auth-field-hint", hidden: true, role: "status" });
  const emailHint = h("div", { className: "auth-field-hint", hidden: true, role: "alert" }, "Enter a valid email address.");

  const message = h("div", { className: "auth-message", role: "alert", hidden: true });
  const submit = h("button", { className: "primary-button auth-submit", type: "submit", disabled: true }, copy.submit);
  const form = h("form", { className: "auth-form", novalidate: true });

  const forgotRow = isLogin
    ? h("div", { className: "auth-forgot-row" }, [h("button", { type: "button", className: "auth-link", onClick: () => navigate("/auth/reset") }, "Forgot password?")])
    : null;

  if (isReset) { passwordCtl.root.hidden = true; }
  if (!wantsNewPassword) { strength.hidden = true; }
  if (!isUpdate) { confirmCtl.root.hidden = true; }
  if (isUpdate) { emailField.hidden = true; }

  form.append(emailField, emailHint);
  form.append(passwordCtl.root);
  if (wantsNewPassword) form.append(strength);
  form.append(confirmCtl.root, matchHint);
  if (forgotRow) form.append(forgotRow);
  form.append(message, submit);

  // ---- State helpers -------------------------------------------------------------
  function setMessage(kind, value) {
    message.classList.remove("is-error", "is-success");
    message.replaceChildren();
    if (!value) { message.hidden = true; return; }
    message.hidden = false;
    message.classList.add(kind === "success" ? "is-success" : "is-error");
    message.append(h("i", { "data-lucide": kind === "success" ? "circle-check" : "circle-alert", "aria-hidden": "true" }), h("span", {}, value));
  }

  function isValid() {
    const emailOk = EMAIL_RE.test(emailInput.value.trim());
    const pw = passwordCtl.input.value;
    if (isReset) return emailOk;
    if (isLogin) return emailOk && pw.length > 0;
    if (isSignup) return emailOk && pw.length >= 8;
    return pw.length >= 8 && confirmCtl.input.value.length >= 8;
  }

  function refresh() {
    submit.disabled = !isValid();
    if (wantsNewPassword) {
      const level = passwordStrength(passwordCtl.input.value);
      strength.dataset.level = String(level);
      strengthLabel.textContent = passwordCtl.input.value ? STRENGTH_LABEL[level] : STRENGTH_LABEL[0];
    }
    if (isUpdate && confirmCtl.input.value) {
      const same = confirmCtl.input.value === passwordCtl.input.value;
      matchHint.hidden = false;
      matchHint.textContent = same ? "Passwords match." : "Passwords don't match yet.";
      matchHint.classList.toggle("is-ok", same);
      matchHint.classList.toggle("is-error", !same);
    } else {
      matchHint.hidden = true;
    }
  }
  form.addEventListener("input", () => { setMessage(null); refresh(); });
  emailInput.addEventListener("blur", () => {
    const bad = emailInput.value.trim() !== "" && !EMAIL_RE.test(emailInput.value.trim());
    emailField.classList.toggle("is-invalid", bad);
    emailInput.setAttribute("aria-invalid", String(bad));
    emailHint.classList.toggle("is-error", bad);
    emailHint.hidden = !bad;
  });
  emailInput.addEventListener("input", () => {
    emailField.classList.remove("is-invalid");
    emailInput.setAttribute("aria-invalid", "false");
    emailHint.classList.remove("is-error");
    emailHint.hidden = true;
  });

  function setBusy(busy) {
    submit.classList.toggle("is-loading", busy);
    submit.setAttribute("aria-busy", String(busy));
    submit.replaceChildren(busy ? h("span", { className: "spinner", "aria-hidden": "true" }) : document.createTextNode(copy.submit));
    submit.disabled = busy ? true : !isValid();
    googleButton.disabled = busy;
  }

  // ---- "Check your email" confirmation view ------------------------------------
  const container = h("main", { className: "screen auth-screen" });
  const content = h("div", { className: "auth-content" });

  function showSent({ heading, email, resend, tip }) {
    const resendBtn = h("button", { type: "button", className: "auth-resend", disabled: true }, "Resend in " + RESEND_SECONDS + "s");
    let timer = 0;
    function startCooldown() {
      let remaining = RESEND_SECONDS;
      resendBtn.disabled = true;
      resendBtn.textContent = "Resend in " + remaining + "s";
      window.clearInterval(timer);
      timer = window.setInterval(() => {
        if (!container.isConnected) return window.clearInterval(timer);
        remaining -= 1;
        if (remaining <= 0) { window.clearInterval(timer); resendBtn.disabled = false; resendBtn.textContent = "Resend email"; }
        else resendBtn.textContent = "Resend in " + remaining + "s";
      }, 1000);
    }
    startCooldown();
    resendBtn.addEventListener("click", async () => {
      resendBtn.disabled = true;
      const { error } = await resend();
      if (error) { showToast(authErrorMessage(error), "error"); resendBtn.disabled = false; return; }
      showToast("Email sent again", "success");
      startCooldown();
    });

    content.replaceChildren(
      h("div", { className: "auth-sent" }, [
        h("div", { className: "auth-sent-icon" }, [h("i", { "data-lucide": "mail-check" })]),
        text("h1", { className: "auth-title" }, heading),
        h("p", { className: "auth-subtitle" }, [document.createTextNode("We sent a link to"), h("strong", {}, email), document.createTextNode(tip)]),
        h("div", { className: "auth-sent-actions" }, [
          h("button", { type: "button", className: "primary-button", onClick: () => navigate("/auth", { replace: true }) }, "Back to sign in"),
          resendBtn,
        ]),
        text("p", { className: "auth-tip" }, "Can't find it? Check your spam folder."),
      ])
    );
    topbar.replaceChildren(h("span", {}));
  }

  // ---- Actions ---------------------------------------------------------------------
  googleButton.addEventListener("click", async () => {
    googleButton.disabled = true;
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/auth" } });
      if (error) throw error;
    } catch (error) {
      setMessage("error", authErrorMessage(error));
      googleButton.disabled = false;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    setMessage(null);
    const email = emailInput.value.trim();
    const redirectTo = window.location.origin + "/auth";
    setBusy(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email, password: passwordCtl.input.value, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        if (data.session) { navigate("/"); return; }
        showSent({ heading: "Check your email", email, tip: "Tap it to confirm your account, then come back to sign in.",
          resend: () => supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectTo } }) });
        return;
      }
      if (isReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        showSent({ heading: "Check your email", email, tip: "Open it to choose a new password.",
          resend: () => supabase.auth.resetPasswordForEmail(email, { redirectTo }) });
        return;
      }
      if (isUpdate) {
        if (passwordCtl.input.value !== confirmCtl.input.value) throw new Error("The two passwords don't match.");
        const { error } = await supabase.auth.updateUser({ password: passwordCtl.input.value });
        if (error) throw error;
        showToast("Password updated", "success");
        navigate("/", { replace: true });
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: passwordCtl.input.value });
      if (error) throw error;
      navigate("/");
    } catch (error) {
      setMessage("error", authErrorMessage(error));
    } finally {
      if (container.isConnected) setBusy(false);
    }
  });

  // ---- Footer -----------------------------------------------------------------------
  const footer = isLogin
    ? h("p", { className: "auth-switch" }, [document.createTextNode("New to Scoutwave? "), h("button", { type: "button", className: "auth-link", onClick: () => navigate("/auth/signup") }, "Create account")])
    : isSignup
      ? h("p", { className: "auth-switch" }, [document.createTextNode("Already have an account? "), h("button", { type: "button", className: "auth-link", onClick: () => navigate("/auth", { replace: true }) }, "Sign in")])
      : null;
  const legal = isLogin || isSignup
    ? h("p", { className: "auth-legal" }, [
        document.createTextNode("By continuing you agree to our "),
        h("button", { type: "button", onClick: () => navigate("/terms-of-use") }, "Terms of Use"),
        document.createTextNode(" and "),
        h("button", { type: "button", onClick: () => navigate("/privacy-policy") }, "Privacy Policy"),
        document.createTextNode("."),
      ])
    : null;

  content.append(brand, title, subtitle);
  if (isLogin || isSignup) content.append(googleButton, divider);
  content.append(form);
  if (footer) content.append(footer);
  if (legal) content.append(legal);

  container.append(h("div", { className: "auth-glow", "aria-hidden": "true" }), topbar, content);
  refresh();
  return container;
}
