// /my-club (the app-icon shortcut): jumps straight to your club's live match, or its next one. With no club picked yet it
// opens the club picker; if nothing can be found it opens the club's page.
import { h, text } from "../utils/h.js";
import { store } from "../store.js";
import { clubById } from "../clubs.js";
import { navigate } from "../router.js";
import { showToast } from "../toast.js";
import { loadClubState, targetPath } from "../myClub.js";

let pending = false; // the app redraws this screen on every store change; only look once

export function MyClubScreen() {
  const club = clubById(store.getState().clubTheme?.id);
  if (!pending) {
    pending = true;
    if (!club) { pending = false; showToast("Pick the club you support first", "default"); queueMicrotask(() => navigate("/appearance", { replace: true })); }
    else loadClubState(club.teamId).then((state) => navigate(targetPath(state, club.teamId), { replace: true })).catch(() => navigate("/club/" + club.teamId, { replace: true })).finally(() => { pending = false; });
  }
  return h("main", { className: "screen my-club-screen" }, [text("p", { className: "muted-copy my-club-loading" }, club ? "Opening " + club.name + "\u2026" : "Opening\u2026")]);
}
