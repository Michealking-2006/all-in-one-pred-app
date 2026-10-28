import { h, text } from "../utils/h.js";
import { showToast } from "../toast.js";
import { sendSupportMessage } from "../api/feedback.js";
import { safeMessage } from "../utils/errors.js";

// One form for the three support screens (report an issue, feedback, contact).
// Nothing is lost on failure: the message stays in the box with a clear error.
export function buildSupportForm({ kind, types = null, typeLabel = "Type", placeholder, authUser = null, withRating = false, withName = false, submitLabel = "Send", successTitle, successBody, onDone }) {
  const root = h("div", { className: "support-form" });

  const type = types ? h("select", { "aria-label": typeLabel }, types.map((v) => text("option", {}, v))) : null;
  const name = withName ? h("input", { type: "text", name: "name", maxlength: "60", autocomplete: "name", placeholder: "Optional", "aria-label": "Your name", value: authUser?.user_metadata?.full_name || "" }) : null;
  const email = h("input", { type: "email", name: "email", autocomplete: "email", inputmode: "email", placeholder: "So we can reply", "aria-label": "Your email", value: authUser?.email || "" });
  const message = h("textarea", { rows: "6", maxlength: "5000", placeholder, "aria-label": "Your message" });
  const trap = h("input", { type: "text", name: "_gotcha", tabindex: "-1", autocomplete: "off", "aria-hidden": "true", className: "support-trap" });
  const error = h("p", { className: "form-error", role: "alert", hidden: true });
  const button = h("button", { type: "button", className: "primary-button" }, submitLabel);

  let rating = 0;
  const stars = withRating ? Array.from({ length: 5 }, (_, i) => h("button", { type: "button", className: "rate-star", "aria-label": `${i + 1} star${i ? "s" : ""}`, "aria-pressed": "false", onClick: () => setRating(i + 1) }, "\u2605")) : [];
  function setRating(value) {
    rating = rating === value ? 0 : value;
    stars.forEach((star, i) => { star.classList.toggle("on", i < rating); star.setAttribute("aria-pressed", String(i + 1 === rating)); });
  }

  const showError = (messageText) => { error.textContent = messageText; error.hidden = false; };

  async function submit() {
    error.hidden = true;
    if (trap.value) { finish(); return; } // a bot filled the hidden field: pretend it worked
    button.disabled = true;
    button.textContent = "Sending\u2026";
    try {
      await sendSupportMessage({
        kind, message: message.value, email: email.value, name: name?.value || "", rating: rating || null, category: type?.value || "",
      });
      finish();
    } catch (err) {
      showError(safeMessage(err, "Your message couldn't be sent. Please try again."));
      showToast("Message not sent", "error");
    } finally {
      button.disabled = false;
      button.textContent = submitLabel;
    }
  }

  function finish() {
    root.replaceChildren(h("section", { className: "card support-success", role: "status" }, [
      h("div", { className: "support-success-icon" }, [h("i", { "data-lucide": "check-circle" })]),
      text("h2", {}, successTitle),
      text("p", {}, successBody),
      h("button", { type: "button", className: "primary-button", onClick: onDone }, "Done"),
    ]));
    showToast("Thanks, message sent", "success");
  }

  button.addEventListener("click", submit);
  // Element.append() turns null into the text "null", so drop the empty slots first.
  root.append(...[
    withRating ? h("section", { className: "card rate-card" }, [text("strong", {}, "How's Scoutwave so far?"), h("div", { className: "rate-stars", role: "group", "aria-label": "Rating" }, stars)]) : null,
    h("section", { className: "form-group" }, [
      type ? h("label", { className: "form-row" }, [text("span", { className: "form-row-label" }, typeLabel), type, h("i", { "data-lucide": "chevron-down", className: "form-row-chevron", "aria-hidden": "true" })]) : null,
      name ? h("label", { className: "form-row" }, [text("span", { className: "form-row-label" }, "Name"), name]) : null,
      h("label", { className: "form-row" }, [text("span", { className: "form-row-label" }, "Email"), email]),
      h("label", { className: "form-row form-row-block" }, [message]),
    ]),
    trap,
    error,
    text("p", { className: "form-footnote" }, "Your message goes straight to the Scoutwave team. Include your email if you'd like a reply."),
    h("div", { className: "form-actions" }, [button])
  ].filter(Boolean));
  return root;
}
