(() => {
  "use strict";

  if (window.__scoutwaveSupabaseClient) {
    return;
  }

  /********* configuration *********/

  const SUPABASE_URL =
    "https://fhsteyglvxuanyvgkkxp.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_l-EwBR_dCGpxDo_87GC1HA_1COYjj3W";

  const STORAGE_KEY =
    "scoutwave-auth";

  /********* dependency check *********/

  if (
    !window.supabase ||
    typeof window.supabase.createClient !==
      "function"
  ) {
    console.error(
      "[Scoutwave] Supabase library is not loaded."
    );

    return;
  }

  /********* storage check *********/

  function getStorage() {
    try {
      const storage =
        window.localStorage;

      const testKey =
        "__scoutwave_storage_test__";

      storage.setItem(testKey, "1");
      storage.removeItem(testKey);

      return storage;
    } catch (error) {
      console.error(
        "[Scoutwave] Browser storage is unavailable:",
        error
      );

      return null;
    }
  }

  const storage =
    getStorage();

  /********* create client *********/

  const client =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          storage,

          storageKey:
            STORAGE_KEY,

          persistSession: true,

          autoRefreshToken: true,

          detectSessionInUrl: true,

          flowType: "pkce",
        },
      }
    );

  /********* expose client *********/

  window.supabaseClient =
    client;

  window.__scoutwaveSupabaseClient =
    true;

  /********* auth state *********/

  const {
    data: authListener,
  } =
    client.auth.onAuthStateChange(
      (event, session) => {
        window.dispatchEvent(
          new CustomEvent(
            "scoutwave:auth-state",
            {
              detail: {
                event,
                session,
                user:
                  session?.user ||
                  null,
              },
            }
          )
        );
      }
    );

  window.__scoutwaveSupabaseAuthSubscription =
    authListener?.subscription ||
    null;
})();