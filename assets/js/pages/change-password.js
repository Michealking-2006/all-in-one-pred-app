/********* change password page *********/

let CHANGE_PASSWORD_PAGE = {
  active: false,
  submitting: false,
  redirectTimer: null,
};

const CHANGE_PASSWORD_SELECTORS = {
  root: "#changePasswordPage",
  form: "#changePasswordForm",
  submit: "#changePasswordSubmit",
  current: "#currentPassword",
  new: "#newPassword",
  confirm: "#confirmPassword",
};

const CHANGE_PASSWORD_RULES = [
  {
    key: "length",
    test: (value) => value.length >= 8,
  },
  {
    key: "uppercase",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    key: "number",
    test: (value) => /[0-9]/.test(value),
  },
];

const CHANGE_PASSWORD_MESSAGES = {
  currentRequired: "Please enter your current password.",
  currentIncorrect: "Current password is incorrect.",
  newRequired: "Please enter a new password.",
  newWeak: "Your new password doesn't meet the requirements below.",
  newSameAsCurrent: "New password must be different from your current password.",
  confirmRequired: "Please confirm your new password.",
  confirmMismatch: "Passwords do not match.",
  genericError: "Unable to update your password. Please try again.",
  signedOut: "You need to be signed in to change your password.",
  success: "Your password has been updated.",
};

/********* helpers *********/

function getSupabaseClient() {
  return window.supabaseClient || null;
}

function getEl(selector, root = document) {
  return root.querySelector(selector);
}

function getCurrentPath() {
  try {
    return (
      window.router?.getCurrentPath?.() ||
      location.pathname
    )
      .split("?")[0]
      .split("#")[0]
      .replace(/\/+$/, "") || "/";
  } catch {
    return (
      location.pathname
        .split("?")[0]
        .split("#")[0]
        .replace(/\/+$/, "") || "/"
    );
  }
}

function notify(type, message, options = {}) {
  const toast = window.Toast || window.toast;

  if (
    toast &&
    typeof toast[type] === "function"
  ) {
    return toast[type](message, options);
  }

  const logger =
    type === "error"
      ? console.error
      : type === "warning"
        ? console.warn
        : console.log;

  logger("[ChangePassword]", message);

  return null;
}

/********* field helpers *********/

function getField(root, name) {
  return getEl(
    CHANGE_PASSWORD_SELECTORS[name],
    root
  );
}

function getFieldWrap(input) {
  return input?.closest(
    ".change-password-field"
  ) || null;
}

function setFieldError(root, name, message) {
  const input = getField(root, name);
  const wrap = getFieldWrap(input);

  const errorEl = root.querySelector(
    `[data-error-for="${name}"]`
  );

  wrap?.classList.add("has-error");

  if (errorEl) {
    errorEl.textContent = message || "";
  }
}

function clearFieldError(root, name) {
  const input = getField(root, name);
  const wrap = getFieldWrap(input);

  const errorEl = root.querySelector(
    `[data-error-for="${name}"]`
  );

  wrap?.classList.remove("has-error");

  if (errorEl) {
    errorEl.textContent = "";
  }
}

function clearAllErrors(root) {
  ["current", "new", "confirm"].forEach(
    (name) => clearFieldError(root, name)
  );
}

/********* password requirements *********/

function evaluateRules(value) {
  const result = {};

  CHANGE_PASSWORD_RULES.forEach((rule) => {
    result[rule.key] = rule.test(value);
  });

  return result;
}

function updateRequirementsUI(root, value) {
  const results = evaluateRules(value);

  CHANGE_PASSWORD_RULES.forEach((rule) => {
    const row = root.querySelector(
      `[data-password-rule="${rule.key}"]`
    );

    row?.classList.toggle(
      "is-valid",
      results[rule.key]
    );
  });

  return results;
}

function passesAllRules(results) {
  return Object.values(results).every(Boolean);
}

/********* toggles *********/

function bindPasswordToggles(root) {
  root
    .querySelectorAll("[data-password-toggle]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId =
          btn.dataset.passwordToggle;

        const input = root.querySelector(
          `#${CSS.escape(targetId)}`
        );

        if (!input) return;

        const shown =
          input.type === "text";

        input.type = shown
          ? "password"
          : "text";

        btn.setAttribute(
          "aria-pressed",
          shown ? "false" : "true"
        );

        btn.setAttribute(
          "aria-label",
          shown
            ? "Show password"
            : "Hide password"
        );
      });
    });
}

/********* live validation *********/

function bindLiveValidation(root) {
  const newInput = getField(root, "new");
  const currentInput = getField(root, "current");
  const confirmInput = getField(root, "confirm");

  newInput?.addEventListener("input", () => {
    updateRequirementsUI(
      root,
      newInput.value
    );

    clearFieldError(root, "new");
  });

  currentInput?.addEventListener("input", () => {
    clearFieldError(root, "current");
  });

  confirmInput?.addEventListener("input", () => {
    clearFieldError(root, "confirm");
  });
}

/********* validation *********/

function validateForm(root, values) {
  clearAllErrors(root);

  let firstInvalid = null;

  const fail = (name, message) => {
    setFieldError(root, name, message);

    if (!firstInvalid) {
      firstInvalid = name;
    }
  };

  if (!values.current) {
    fail(
      "current",
      CHANGE_PASSWORD_MESSAGES.currentRequired
    );
  }

  if (!values.next) {
    fail(
      "new",
      CHANGE_PASSWORD_MESSAGES.newRequired
    );
  } else {
    const results = updateRequirementsUI(
      root,
      values.next
    );

    if (!passesAllRules(results)) {
      fail(
        "new",
        CHANGE_PASSWORD_MESSAGES.newWeak
      );
    } else if (
      values.current &&
      values.next === values.current
    ) {
      fail(
        "new",
        CHANGE_PASSWORD_MESSAGES.newSameAsCurrent
      );
    }
  }

  if (!values.confirm) {
    fail(
      "confirm",
      CHANGE_PASSWORD_MESSAGES.confirmRequired
    );
  } else if (
    values.next &&
    values.confirm !== values.next
  ) {
    fail(
      "confirm",
      CHANGE_PASSWORD_MESSAGES.confirmMismatch
    );
  }

  return firstInvalid;
}

/********* submitting state *********/

function setSubmitting(root, submitting) {
  CHANGE_PASSWORD_PAGE.submitting = submitting;

  const submitBtn = getEl(
    CHANGE_PASSWORD_SELECTORS.submit,
    root
  );

  if (!submitBtn) return;

  submitBtn.disabled = submitting;

  submitBtn.textContent = submitting
    ? "Updating..."
    : "Update Password";
}

/********* reset *********/

function resetForm(root) {
  const form = getEl(
    CHANGE_PASSWORD_SELECTORS.form,
    root
  );

  form?.reset();

  clearAllErrors(root);
  updateRequirementsUI(root, "");

  root
    .querySelectorAll("[data-password-toggle]")
    .forEach((btn) => {
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", "Show password");
    });

  root
    .querySelectorAll(
      '.change-password-input-wrap input[type="text"]'
    )
    .forEach((input) => {
      input.type = "password";
    });
}

/********* submit *********/

async function handleSubmit(event, root) {
  event.preventDefault();

  if (CHANGE_PASSWORD_PAGE.submitting) {
    return;
  }

  const currentInput = getField(root, "current");
  const newInput = getField(root, "new");
  const confirmInput = getField(root, "confirm");

  const values = {
    current: currentInput?.value || "",
    next: newInput?.value || "",
    confirm: confirmInput?.value || "",
  };

  const firstInvalid = validateForm(root, values);

  if (firstInvalid) {
    getField(root, firstInvalid)?.focus();
    return;
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    notify(
      "error",
      CHANGE_PASSWORD_MESSAGES.genericError
    );

    return;
  }

  setSubmitting(root, true);

  try {
    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (
      userError ||
      !userData?.user?.email
    ) {
      notify(
        "error",
        CHANGE_PASSWORD_MESSAGES.signedOut
      );

      window.router?.navigate
        ? window.router.navigate("/profile")
        : window.location.assign("/profile");

      return;
    }

    const {
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: values.current,
    });

    if (!CHANGE_PASSWORD_PAGE.active) return;

    if (signInError) {
      setFieldError(
        root,
        "current",
        CHANGE_PASSWORD_MESSAGES.currentIncorrect
      );

      currentInput?.focus();

      return;
    }

    const {
      error: updateError,
    } = await supabase.auth.updateUser({
      password: values.next,
    });

    if (!CHANGE_PASSWORD_PAGE.active) return;

    if (updateError) {
      if (
        /same|different/i.test(
          updateError.message || ""
        )
      ) {
        setFieldError(
          root,
          "new",
          CHANGE_PASSWORD_MESSAGES.newSameAsCurrent
        );

        newInput?.focus();
      } else {
        notify(
          "error",
          updateError.message ||
            CHANGE_PASSWORD_MESSAGES.genericError
        );
      }

      return;
    }

    notify(
      "success",
      CHANGE_PASSWORD_MESSAGES.success
    );

    resetForm(root);

    CHANGE_PASSWORD_PAGE.redirectTimer =
      window.setTimeout(() => {
        if (!CHANGE_PASSWORD_PAGE.active) return;

        window.router?.navigate
          ? window.router.navigate("/profile")
          : window.location.assign("/profile");
      }, 900);
  } catch (error) {
    console.error(
      "[ChangePassword] Update failed:",
      error
    );

    if (CHANGE_PASSWORD_PAGE.active) {
      notify(
        "error",
        CHANGE_PASSWORD_MESSAGES.genericError
      );
    }
  } finally {
    if (CHANGE_PASSWORD_PAGE.active) {
      setSubmitting(root, false);
    }
  }
}

/********* lifecycle *********/

function destroyChangePasswordPage() {
  if (CHANGE_PASSWORD_PAGE.redirectTimer) {
    clearTimeout(
      CHANGE_PASSWORD_PAGE.redirectTimer
    );

    CHANGE_PASSWORD_PAGE.redirectTimer = null;
  }

  CHANGE_PASSWORD_PAGE.active = false;
  CHANGE_PASSWORD_PAGE.submitting = false;
}

function initChangePasswordPage() {
  const root = getEl(
    CHANGE_PASSWORD_SELECTORS.root
  );

  if (!root) {
    return;
  }

  if (CHANGE_PASSWORD_PAGE.active) {
    return;
  }

  CHANGE_PASSWORD_PAGE.active = true;
  CHANGE_PASSWORD_PAGE.submitting = false;

  const form = getEl(
    CHANGE_PASSWORD_SELECTORS.form,
    root
  );

  form?.addEventListener("submit", (event) => {
    handleSubmit(event, root);
  });

  bindPasswordToggles(root);
  bindLiveValidation(root);
  updateRequirementsUI(root, "");
}

/********* page lifecycle *********/

function handleChangePasswordPageLifecycle(event) {
  const path =
    event?.detail?.path ||
    getCurrentPath();

  const cleanPath =
    String(path)
      .split("?")[0]
      .split("#")[0]
      .replace(/\/+$/, "") || "/";

  if (cleanPath === "/security/change-password") {
    initChangePasswordPage();
    return;
  }

  destroyChangePasswordPage();
}

/********* router lifecycle *********/

document.addEventListener(
  "pageLoaded",
  handleChangePasswordPageLifecycle
);

document.addEventListener(
  "pageRefreshed",
  handleChangePasswordPageLifecycle
);

/********* direct boot *********/

if (
  getCurrentPath() ===
  "/security/change-password"
) {
  queueMicrotask(
    initChangePasswordPage
  );
}

/********* router registry *********/

window.router?.registerPage?.(
  "ChangePasswordPage",
  {
    init: initChangePasswordPage,
    destroy: destroyChangePasswordPage,
  }
);
