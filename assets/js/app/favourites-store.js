(() => {
  "use strict";

  if (window.FavouritesStore) return;

  const VALID_TYPES = new Set(["league", "club", "player", "match"]);

  const state = {
    loaded: false,
    loadPromise: null,
    items: new Map(), // key: `${type}:${id}` -> row
  };

  const getSupabase = () => window.supabaseClient || window.supabase || null;

  function key(type, id) {
    return `${type}:${id}`;
  }

  async function getUserId() {
    const client = getSupabase();
    if (!client?.auth) return null;

    const { data } = await client.auth.getUser().catch(() => ({ data: {} }));
    return data?.user?.id || null;
  }

  /* -----------------------------------------------------------
   * load (once per session, refreshed after mutations)
   * --------------------------------------------------------- */

  async function ensureLoaded({ force = false } = {}) {
    if (state.loaded && !force) return state.items;
    if (state.loadPromise && !force) return state.loadPromise;

    state.loadPromise = (async () => {
      const client = getSupabase();
      const userId = await getUserId();

      if (!client || !userId) {
        state.items = new Map();
        state.loaded = true;
        return state.items;
      }

      const { data, error } = await client
        .from("favourites")
        .select("id, entity_type, entity_id, entity_slug, entity_name, entity_subtitle, entity_image, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[FavouritesStore] load failed:", error);
        state.items = new Map();
      } else {
        state.items = new Map(
          (data || []).map((row) => [key(row.entity_type, row.entity_id), row])
        );
      }

      state.loaded = true;
      return state.items;
    })();

    try {
      return await state.loadPromise;
    } finally {
      state.loadPromise = null;
    }
  }

  /* -----------------------------------------------------------
   * public api
   * --------------------------------------------------------- */

  async function has(type, id) {
    await ensureLoaded();
    return state.items.has(key(type, id));
  }

  async function list(type) {
    await ensureLoaded();
    const all = [...state.items.values()];
    return type ? all.filter((row) => row.entity_type === type) : all;
  }

  async function add(type, id, meta = {}) {
    if (!VALID_TYPES.has(type)) throw new Error(`Invalid favourite type: ${type}`);

    const client = getSupabase();
    const userId = await getUserId();
    if (!client || !userId) throw new Error("You need to be logged in to save favourites.");

    await ensureLoaded();
    if (state.items.has(key(type, id))) return state.items.get(key(type, id));

    const row = {
      user_id: userId,
      entity_type: type,
      entity_id: String(id),
      entity_slug: meta.slug || null,
      entity_name: meta.name || "",
      entity_subtitle: meta.subtitle || null,
      entity_image: meta.image || null,
    };

    const { data, error } = await client
      .from("favourites")
      .upsert(row, { onConflict: "user_id,entity_type,entity_id" })
      .select()
      .single();

    if (error) throw error;

    state.items.set(key(type, id), data);
    document.dispatchEvent(new CustomEvent("scoutwave:favourites-changed"));
    return data;
  }

  async function remove(type, id) {
    const client = getSupabase();
    const userId = await getUserId();
    if (!client || !userId) return;

    await ensureLoaded();

    const { error } = await client
      .from("favourites")
      .delete()
      .eq("user_id", userId)
      .eq("entity_type", type)
      .eq("entity_id", String(id));

    if (error) throw error;

    state.items.delete(key(type, id));
    document.dispatchEvent(new CustomEvent("scoutwave:favourites-changed"));
  }

  async function toggle(type, id, meta = {}) {
    const already = await has(type, id);
    if (already) {
      await remove(type, id);
      return false;
    }
    await add(type, id, meta);
    return true;
  }

  function reset() {
    state.loaded = false;
    state.items = new Map();
  }

  window.FavouritesStore = { has, list, add, remove, toggle, reset };

  // clear the in-memory cache whenever the auth session changes,
  // so switching accounts doesn't leak the previous user's favourites
  window.addEventListener("scoutwave:auth-state", reset);
})();
