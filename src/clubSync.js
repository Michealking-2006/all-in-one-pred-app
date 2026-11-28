// Keeps the club a person supports on their account (user_metadata.club: a club id, or "none") as well as on the
// phone. Loaded only once someone is signed in; the first screen never needs it.
import { store } from "./store.js";
import { supabase } from "./api/supabase.js";
import { clubById, clubFromSaved, clubSnapshot, isClubId } from "./clubs.js";

// value: "none", or a club's saved form (clubSnapshot). The four quick picks are stored by id alone; any other club
// also carries its name, crest and colours (club_data) so a new phone can wear it without searching again.
export async function saveClubToAccount(value) {
  if (!store.getState().authUser) return;
  const snap = value && typeof value === "object" ? value : null;
  try {
    const { data, error } = await supabase.auth.updateUser({ data: { club: snap ? snap.id : value, club_data: snap && snap.custom ? snap : null } });
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
  const remoteClub = isClubId(remote) ? clubFromSaved(clubById(remote) ? { id: remote } : { ...user.user_metadata?.club_data, id: remote }) : null;
  if (remoteClub) {
    if (state.clubTheme?.id !== remoteClub.id) store.setState({ clubTheme: clubSnapshot(remoteClub) });
  } else if (remote === "none") {
    if (state.clubTheme || state.clubPromptUntil !== Number.MAX_SAFE_INTEGER) store.setState({ clubTheme: null, clubPromptUntil: Number.MAX_SAFE_INTEGER });
  } else if (state.clubTheme) {
    saveClubToAccount(state.clubTheme);
  }
}
