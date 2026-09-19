import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://fhsteyglvxuanyvgkkxp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_l-EwBR_dCGpxDo_87GC1HA_1COYjj3W";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export function authErrorMessage(error) {
  const message = String(error?.message || "");
  if (/invalid login credentials/i.test(message)) return "The email or password is incorrect.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email address before signing in.";
  if (/already registered|already exists/i.test(message)) return "An account with this email already exists.";
  if (/password/i.test(message) && /characters|length|weak/i.test(message)) return "Choose a stronger password with at least 8 characters.";
  return message || "Something went wrong. Please try again.";
}
