// Glue between the model and the app: fetches the league table (one cached
// request per competition, shared by every match in it), runs the model, and
// records the prediction for accuracy tracking. Uses no third-party prediction
// service of any kind.
import { getStandings } from "../api/footballApi.js";
import { tableFor, predictFromTable } from "./model.js";
import { recordPrediction } from "./tracker.js";

// Resolves to a prediction, or null when the competition has no usable table
// (cup knockouts, friendlies) or a team isn't in it. Network errors reject.
export function predictFixture(fx, { form = {} } = {}) {
  const leagueId = fx?.league?.id, season = fx?.league?.season;
  const homeId = fx?.teams?.home?.id, awayId = fx?.teams?.away?.id;
  if (!leagueId || !season || !homeId || !awayId) return Promise.resolve(null);
  return getStandings(leagueId, season).then((response) => {
    const rows = tableFor(response, homeId, awayId);
    const prediction = predictFromTable({ homeId, awayId, rows, form });
    if (prediction) {
      prediction.fixtureId = fx.fixture?.id;
      recordPrediction(fx, prediction);
    }
    return prediction;
  });
}

export const pickLabel = (prediction, fx) =>
  prediction.pick === "draw" ? "Draw" : (prediction.pick === "home" ? fx.teams?.home?.name : fx.teams?.away?.name) || (prediction.pick === "home" ? "Home win" : "Away win");
