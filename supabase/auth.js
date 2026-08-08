/****** App Config ******/

const SUPABASE = window.supabaseClient || null;
const AUTH_ORIGIN = window.location.origin;
const APP_ORIGIN = "https://app.myscoutwave.com";

/****** DOM Helpers ******/

function qs(sel, root = document) {
  return root.querySelector(sel);
}

function qsa(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

/****** Supabase Helpers ******/

function requireSupabase() {
  if (!SUPABASE) {
    showNotice("Something went wrong. Please try again later.", "error");
    return false;
  }
  return true;
}

async function getSession() {
  if (!requireSupabase()) return null;

  const { data, error } = await SUPABASE.auth.getSession();

  if (error) {
    console.error(error);
    return null;
  }

  return data?.session || null;
}

async function getCurrentUser() {
  if (!requireSupabase()) return null;

  const { data, error } = await SUPABASE.auth.getUser();

  if (error) {
    console.error(error);
    return null;
  }

  return data?.user || null;
}

function redirectToApp() {
  window.location.replace(APP_ORIGIN);
}

function redirectToAuth(page = "login.html") {
  window.location.replace(`${AUTH_ORIGIN}/${page}`);
}

/****** Validation Helpers ******/

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isPasswordValid(value) {
  return String(value || "").trim().length >= 8;
}

/****** UI Helpers ******/

function showNotice(message, type = "success") {
  const el = qs("[data-notice]");
  if (!el) return;

  el.textContent = message;
  el.className = `notice show ${type}`;

  window.clearTimeout(showNotice._timer);
  showNotice._timer = window.setTimeout(() => {
    el.className = "notice";
    el.textContent = "";
  }, 3600);
}

function setBusy(form, busy) {
  const btn = qs(".primary", form);
  if (!btn) return;

  btn.disabled = busy;
  btn.classList.toggle("loading", busy);
}

function clearFieldState(field) {
  if (!field) return;

  field.classList.remove("invalid");

  const error = qs(".error-text", field);
  if (error) error.textContent = "";
}

function setFieldError(field, message) {
  if (!field) return;

  field.classList.add("invalid");

  const error = qs(".error-text", field);
  if (error) error.textContent = message;
}

function clearFormState(form) {
  qsa(".field", form).forEach(clearFieldState);
}

/****** Password Toggles ******/

function bindPasswordToggles(root = document) {
  const SHOW_ICON = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" fill-rule="evenodd" d="M8.06 2C3 2 0 8 0 8s3 6 8.06 6C13 14 16 8 16 8s-3-6-7.94-6zM8 12c-2.2 0-4-1.78-4-4c0-2.2 1.8-4 4-4c2.22 0 4 1.8 4 4c0 2.22-1.78 4-4 4zm2-4c0 1.11-.89 2-2 2c-1.11 0-2-.89-2-2c0-1.11.89-2 2-2c1.11 0 2 .89 2 2z"></path>
    </svg>`;

  const HIDE_ICON = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 14" aria-hidden="true">
      <path fill="currentColor" fill-rule="evenodd" d="M14.822.854a.5.5 0 1 0-.707-.708l-2.11 2.11C10.89 1.483 9.565.926 8.06.926c-5.06 0-8.06 6-8.06 6s1.162 2.323 3.258 4.078l-2.064 2.065a.5.5 0 1 0 .707.707L14.822.854zM4.86 9.403L6.292 7.97A1.999 1.999 0 0 1 6 6.925c0-1.11.89-2 2-2c.384 0 .741.106 1.045.292l1.433-1.433A3.98 3.98 0 0 0 8 2.925c-2.2 0-4 1.8-4 4c0 .938.321 1.798.859 2.478zm7.005-3.514l1.993-1.992A14.873 14.873 0 0 1 16 6.925s-3 6-7.94 6a6.609 6.609 0 0 1-2.661-.57l1.565-1.566c.33.089.678.136 1.036.136c2.22 0 4-1.78 4-4c0-.358-.047-.705-.136-1.036zM9.338 8.415l.152-.151a1.996 1.996 0 0 1-.152.151z"></path>
    </svg>`;

  qsa("[data-password-toggle]", root).forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "true";

    const target = qs(`#${btn.dataset.passwordToggle}`);
    if (!target) return;

    btn.innerHTML = SHOW_ICON;
    btn.setAttribute("aria-label", "Show password");

    btn.addEventListener("click", () => {
      const shouldShow = target.type === "password";
      target.type = shouldShow ? "text" : "password";
      btn.innerHTML = shouldShow ? HIDE_ICON : SHOW_ICON;
      btn.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
    });
  });
}

/****** Auth Guards ******/

async function redirectIfAlreadySignedIn() {
  const session = await getSession();
  if (session) {
    redirectToApp();
    return true;
  }
  return false;
}

async function ensureSignedInOrRedirect() {
  const user = await getCurrentUser();

  if (!user) {
    redirectToAuth("login.html");
    return null;
  }

  return user;
}

/****** Login Page ******/

function loginPage() {
  const form = qs("#loginForm");
  if (!form) return;

  bindPasswordToggles(form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormState(form);

    const emailField = qs("#loginEmail");
    const passwordField = qs("#loginPassword");

    let ok = true;

    if (!emailField.value.trim()) {
      setFieldError(emailField.closest(".field"), "Email address is required.");
      ok = false;
    } else if (!isEmail(emailField.value)) {
      setFieldError(emailField.closest(".field"), "Enter a valid email address.");
      ok = false;
    }

    if (!passwordField.value.trim()) {
      setFieldError(passwordField.closest(".field"), "Password is required.");
      ok = false;
    } else if (!isPasswordValid(passwordField.value)) {
      setFieldError(passwordField.closest(".field"), "Password must be at least 8 characters.");
      ok = false;
    }

    if (!ok) return;

    setBusy(form, true);

    const { data, error } = await SUPABASE.auth.signInWithPassword({
      email: normalizeEmail(emailField.value),
      password: passwordField.value,
    });

    setBusy(form, false);

    if (error) {
      setFieldError(passwordField.closest(".field"), "Email or password is incorrect.");
      showNotice(error.message || "Login failed. Check your details and try again.", "error");
      return;
    }

    if (data?.user) {
      showNotice("Welcome back.", "success");
      window.setTimeout(redirectToApp, 700);
      return;
    }

    showNotice("Login successful.", "success");
    window.setTimeout(redirectToApp, 700);
  });
}

/****** Sign Up Page ******/

function signupPage() {
  const form = qs("#signupForm");
  if (!form) return;

  bindPasswordToggles(form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormState(form);

    const fullName = qs("#fullName");
    const email = qs("#signupEmail");
    const passwordField = qs("#signupPassword");
    const confirm = qs("#signupConfirm");

    let ok = true;

    if (!fullName.value.trim()) {
      setFieldError(fullName.closest(".field"), "Full name is required.");
      ok = false;
    }

    if (!email.value.trim()) {
      setFieldError(email.closest(".field"), "Email address is required.");
      ok = false;
    } else if (!isEmail(email.value)) {
      setFieldError(email.closest(".field"), "Enter a valid email address.");
      ok = false;
    }

    if (!passwordField.value.trim()) {
      setFieldError(passwordField.closest(".field"), "Password is required.");
      ok = false;
    } else if (!isPasswordValid(passwordField.value)) {
      setFieldError(passwordField.closest(".field"), "Password must be at least 8 characters.");
      ok = false;
    }

    if (!confirm.value.trim()) {
      setFieldError(confirm.closest(".field"), "Please confirm your password.");
      ok = false;
    } else if (confirm.value !== passwordField.value) {
      setFieldError(confirm.closest(".field"), "Passwords do not match.");
      ok = false;
    }

    if (!ok) return;

    setBusy(form, true);

    const { data, error } = await SUPABASE.auth.signUp({
      email: normalizeEmail(email.value),
      password: passwordField.value,
      options: {
        data: {
          full_name: fullName.value.trim(),
        },
        emailRedirectTo: `${AUTH_ORIGIN}/login.html`,
      },
    });

    setBusy(form, false);

    if (error) {
      showNotice(error.message || "Account creation failed.", "error");
      return;
    }

    if (data?.session) {
      showNotice("Account created successfully.", "success");
      window.setTimeout(redirectToApp, 700);
      return;
    }

    showNotice("Account created. Check your email to verify your account.", "success");
    window.setTimeout(() => {
      redirectToAuth("login.html");
    }, 1200);
  });
}

/****** Forgot Password Page ******/

function forgotPage() {
  const form = qs("#forgotForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormState(form);

    const emailField = qs("#forgotEmail");

    if (!emailField.value.trim()) {
      setFieldError(emailField.closest(".field"), "Email address is required.");
      return;
    }

    if (!isEmail(emailField.value)) {
      setFieldError(emailField.closest(".field"), "Enter a valid email address.");
      return;
    }

    setBusy(form, true);

    const { error } = await SUPABASE.auth.resetPasswordForEmail(normalizeEmail(emailField.value), {
      redirectTo: `${AUTH_ORIGIN}/reset-password.html`,
    });

    setBusy(form, false);

    if (error) {
      showNotice(error.message || "Password reset failed.", "error");
      return;
    }

    showNotice("Password reset email sent.", "success");
  });
}

/****** Reset Password Page ******/

function resetPage() {
  const form = qs("#resetForm");
  if (!form) return;

  bindPasswordToggles(form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormState(form);

    const passwordField = qs("#newPassword");
    const confirmField = qs("#confirmNewPassword");

    let ok = true;

    if (!passwordField.value.trim()) {
      setFieldError(passwordField.closest(".field"), "New password is required.");
      ok = false;
    } else if (!isPasswordValid(passwordField.value)) {
      setFieldError(passwordField.closest(".field"), "Password must be at least 8 characters.");
      ok = false;
    }

    if (!confirmField.value.trim()) {
      setFieldError(confirmField.closest(".field"), "Please confirm your password.");
      ok = false;
    } else if (confirmField.value !== passwordField.value) {
      setFieldError(confirmField.closest(".field"), "Passwords do not match.");
      ok = false;
    }

    if (!ok) return;

    setBusy(form, true);

    const { error } = await SUPABASE.auth.updateUser({
      password: passwordField.value,
    });

    setBusy(form, false);

    if (error) {
      showNotice(error.message || "Password update failed. The reset link may be invalid or expired.", "error");
      return;
    }

    showNotice("Password updated successfully.", "success");
    window.setTimeout(() => {
      redirectToAuth("login.html");
    }, 900);
  });
}

/****** Dashboard Page ******/

async function dashboardPage() {
  const user = await ensureSignedInOrRedirect();
  if (!user) return;

  const nameEl = qs("[data-current-user-name]");
  const emailEl = qs("[data-current-user-email]");
  const badgeEl = qs("[data-current-user-badge]");
  const logoutBtn = qs("[data-logout]");

  const displayName =
    user.user_metadata?.full_name ||
    user.email ||
    "User";

  if (nameEl) nameEl.textContent = displayName;
  if (emailEl) emailEl.textContent = user.email || "";
  if (badgeEl) badgeEl.textContent = displayName.trim().charAt(0).toUpperCase();

  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = "true";

    logoutBtn.addEventListener("click", async () => {
      await SUPABASE.auth.signOut();
      redirectToAuth("login.html");
    });
  }
}

/****** App Init ******/

async function init() {
  const page = document.body.dataset.page;

  if (!SUPABASE) {
    showNotice("Something went wrong. Please refresh the page and try again.", "error");
    return;
  }

  if (page === "login" || page === "signup") {
    const signedIn = await redirectIfAlreadySignedIn();
    if (signedIn) return;
  }

  if (page === "login") loginPage();
  if (page === "signup") signupPage();
  if (page === "forgot") forgotPage();
  if (page === "reset") resetPage();
  if (page === "dashboard") dashboardPage();
}

document.addEventListener("DOMContentLoaded", init);