// Which models the server records. The first is the one the app serves (the current model);
// the rest are older versions kept running on the same matches so they can be compared on
// identical data (Admin > Predictions). Recording a shadow costs no football API requests.
// The leading underscore keeps Vercel from exposing this file as a function.
import { MODEL_VERSION, predictFromTable } from "../src/predictions/model.js";
import { MODEL_VERSION as V3, predictFromMatches } from "../src/predictions/ratings.js";
import { MODEL_VERSION as V1, predictFromTable as predictV1 } from "../src/predictions/poisson-v1.js";

export const CURRENT = { model: MODEL_VERSION, predict: predictFromTable };
// ratings-v3 needs the season's finished matches (one extra football API call per competition); it is skipped
// when the budget is spent or PREDICT_RATINGS=0, and is never shown in the app until it wins the comparison.
export const SHADOWS = [{ model: V1, predict: predictV1 }, { model: V3, predict: predictFromMatches, needsMatches: true }];
export const ALL_MODELS = [CURRENT, ...SHADOWS];
export const SHADOW_NAMES = SHADOWS.map((m) => m.model);
export const ALL_NAMES = ALL_MODELS.map((m) => m.model);
