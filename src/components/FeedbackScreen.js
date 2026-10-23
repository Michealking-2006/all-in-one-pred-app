import { h } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { buildSupportForm } from "./SupportForm.js";

const FEEDBACK_TYPES = ["Idea or suggestion", "Something I love", "Something to improve", "Other"];

export function FeedbackScreen({ onBack, authUser }) {
  return h("main", { className: "screen account-form-screen" }, [
    PageHeader({ title: "Send feedback", onBack }),
    buildSupportForm({
      kind: "feedback", types: FEEDBACK_TYPES, typeLabel: "About", authUser, withRating: true,
      placeholder: "Tell us what you think. What would make Scoutwave better for you?",
      submitLabel: "Send feedback",
      successTitle: "Thank you!",
      successBody: "Your feedback helps shape what we build next.",
      onDone: onBack,
    }),
  ]);
}
