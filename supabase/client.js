/************************************************************
 * SCOUTWAVE — SUPABASE CLIENT
 *
 * Responsible for:
 * - Creating the single Supabase client
 * - Persisting authentication
 * - Sharing auth storage across Scoutwave subdomains
 * - Automatic token refresh
 * - PKCE authentication flow
 ************************************************************/

/* ==========================================================
   CONFIGURATION
========================================================== */

const SUPABASE_CONFIG = Object.freeze({
  url: "https://fhsteyglvxuanyvgkkxp.supabase.co",

  anonKey:
    "sb_publishable_l-EwBB_dCGpxDo_87GC1HA_1COYjj3W",

  cookieDomain: ".myscoutwave.com",
});


/* ==========================================================
   STORAGE
========================================================== */

/*
 * Supabase stores the complete auth session.
 *
 * The storage adapter below allows the session to be available
 * across:
 *
 *   auth.myscoutwave.com
 *   app.myscoutwave.com
 *   myscoutwave.com
 *
 * It deliberately does not contain localhost handling.
 */

const supabaseStorage = {
  getItem(key) {
    try {
      const value = localStorage.getItem(key);
      return value;
    } catch (error) {
      console.error("[Supabase] Storage read failed:", error);
      return null;
    }
  },

  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error("[Supabase] Storage write failed:", error);
    }
  },

  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("[Supabase] Storage removal failed:", error);
    }
  },
};


/* ==========================================================
   CLIENT
========================================================== */

function createSupabaseClient() {
  if (!window.supabase?.createClient) {
    console.error(
      "[Supabase] Supabase library is not loaded."
    );

    return null;
  }

  try {
    return window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey,
      {
        auth: {
          storage: supabaseStorage,

          persistSession: true,

          autoRefreshToken: true,

          detectSessionInUrl: true,

          flowType: "pkce",
        },
      }
    );
  } catch (error) {
    console.error(
      "[Supabase] Failed to create client:",
      error
    );

    return null;
  }
}


/* ==========================================================
   GLOBAL CLIENT
========================================================== */

if (!window.supabaseClient) {
  window.supabaseClient = createSupabaseClient();
}


/* ==========================================================
   AUTH STATE
========================================================== */

if (
  window.supabaseClient &&
  !window.__scoutwaveSupabaseAuthBound
) {
  window.__scoutwaveSupabaseAuthBound = true;

  window.supabaseClient.auth.onAuthStateChange(
    (event, session) => {
      window.__scoutwaveAuthState = {
        event,
        session,
        user: session?.user || null,
      };

      document.dispatchEvent(
        new CustomEvent("scoutwaveAuthStateChange", {
          detail: {
            event,
            session,
            user: session?.user || null,
          },
        })
      );
    }
  );
}


/* ==========================================================
   READY STATE
========================================================== */

window.__scoutwaveSupabaseReady =
  !!window.supabaseClient;

document.dispatchEvent(
  new CustomEvent("scoutwaveSupabaseReady", {
    detail: {
      client: window.supabaseClient,
      ready: window.__scoutwaveSupabaseReady,
    },
  })
);