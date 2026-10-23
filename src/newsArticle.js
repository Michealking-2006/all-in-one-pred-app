// Our own address for a news story: /news/<headline-words>-<id>. The headline words are only for
// people and search engines; the id at the end is what finds the story. Shared by the app and the
// server (which renders the page for search engines and link previews).
import { slugify } from "./utils/slug.js";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ID_AT_END = new RegExp(`(?:^|-)(${UUID}|[0-9a-f]{32})$`);

export const articlePath = (article) => {
  const words = slugify(String(article.title || "")).slice(0, 60).replace(/-+$/, "");
  return `/news/${words ? words + "-" : ""}${article.id}`;
};

// "/news/some-words-<id>" segment -> id, or "" when it isn't one of ours.
export const parseArticleId = (segment) => {
  const m = ID_AT_END.exec(String(segment || "").toLowerCase());
  return m ? m[1] : "";
};
export const isProviderId = (id) => new RegExp(`^${UUID}$`).test(id);
