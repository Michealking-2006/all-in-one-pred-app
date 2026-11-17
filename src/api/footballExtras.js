// Football endpoints only the lazily loaded screens use (Transfers & injuries, Rivalry). Kept out of footballApi.js so the
// code that runs at startup doesn't carry them.
import { footballRaw } from "./footballApi.js";

export const getTeamTransfers = (team) => footballRaw("transfers", { team });
export const getTeamInjuries = (team, season) => footballRaw("injuries", { team, season });
export const getNextMeeting = (a, b) => footballRaw("fixtures/headtohead", { h2h: a + "-" + b, next: 1 });
