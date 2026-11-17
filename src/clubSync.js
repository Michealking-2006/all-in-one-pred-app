// Keeps the club a person supports on their account (user_metadata.club: a club id, or "none") as well as on the
// phone. Loaded only once someone is signed in; the first screen never needs it.
import { store } from "./store.js";
import { supabase } from "./api/supabase.js";
import { CLUB_IDS, clubById } from "./clubs.js";

export async function saveClubToAccount(value) {
  if (!store.getState().authUser) return;
  try {
    const { data, error } = await supabase.auth.updateUser({ data: { club: value } });
    if (!error && data?.user) store.setState({ authUser: data.user }, { silent: true });
  } catch { /* the phone keeps the choice; it is sent again next time */ }
}

// Once per sign-in: the account's club wins on a new phone; a club picked before signing in is saved to the account;
// someone with no club anywhere is asked by the welcome screen (src/components/ClubWelcome.js).
let syncedFor = null;
export function syncClubWithAccount(state) {
  const user = state.authUser;
  if (!user) { syncedFor = null; return; }
  if (syncedFor === user.id) return;
  syncedFor = user.id;
  const remote = user.user_metadata?.club;
  if (CLUB_IDS.includes(remote)) {
    if (state.clubTheme?.id !== remote) store.setState({ clubTheme: { id: remote, primary: clubById(remote).primary } });
  } else if (remote === "none") {
    if (state.clubTheme || state.clubPromptUntil !== Number.MAX_SAFE_INTEGER) store.setState({ clubTheme: null, clubPromptUntil: Number.MAX_SAFE_INTEGER });
  } else if (state.clubTheme) {
    saveClubToAccount(state.clubTheme.id);
  }
}
