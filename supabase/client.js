
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

  /*
   * auth.myscoutwave.com
   * and
   * app.myscoutwave.com
   *
   * must share this storage.
   */
  const COOKIE_DOMAIN =
    ".myscoutwave.com";

  const COOKIE_PREFIX =
    "scoutwave-auth";

  const STORAGE_KEY =
    "scoutwave-auth";

  const COOKIE_MAX_AGE =
    60 * 60 * 24 * 30;

  const COOKIE_CHUNK_SIZE =
    3000;

  const MAX_COOKIE_CHUNKS =
    20;

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

  /********* cookie helpers *********/

  function encode(value) {
    return encodeURIComponent(
      String(value)
    );
  }

  function decode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  function escapeRegExp(value) {
    return String(value).replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
  }

  function getCookie(name) {
    const encodedName =
      encode(name);

    const match =
      document.cookie.match(
        new RegExp(
          `(?:^|;\\s*)${escapeRegExp(
            encodedName
          )}=([^;]*)`
        )
      );

    if (!match) {
      return null;
    }

    return decode(match[1]);
  }

  function setCookie(
    name,
    value,
    maxAge = COOKIE_MAX_AGE
  ) {
    if (
      typeof value !== "string" ||
      !value
    ) {
      return;
    }

    document.cookie =
      `${encode(name)}=${encode(value)};` +
      `Path=/;` +
      `Domain=${COOKIE_DOMAIN};` +
      `Max-Age=${Math.max(
        0,
        Math.floor(maxAge)
      )};` +
      `SameSite=Lax;` +
      `Secure`;
  }

  function removeCookie(name) {
    document.cookie =
      `${encode(name)}=;` +
      `Path=/;` +
      `Domain=${COOKIE_DOMAIN};` +
      `Max-Age=0;` +
      `SameSite=Lax;` +
      `Secure`;
  }

  /********* storage keys *********/

  function getBaseKey(name) {
    return `${COOKIE_PREFIX}-${name}`;
  }

  function getCountKey(name) {
    return `${getBaseKey(name)}-count`;
  }

  function getChunkKey(
    name,
    index
  ) {
    return `${getBaseKey(name)}-${index}`;
  }

  /********* read stored value *********/

  function getStoredValue(name) {
    const countRaw =
      getCookie(
        getCountKey(name)
      );

    const count =
      Number(countRaw);

    /*
     * Reject malformed cookie metadata.
     */
    if (
      Number.isInteger(count) &&
      count > 0
    ) {
      if (
        count >
        MAX_COOKIE_CHUNKS
      ) {
        return null;
      }

      let value = "";

      for (
        let i = 0;
        i < count;
        i++
      ) {
        const chunk =
          getCookie(
            getChunkKey(
              name,
              i
            )
          );

        if (
          typeof chunk !==
          "string"
        ) {
          return null;
        }

        value += chunk;
      }

      return value;
    }

    return getCookie(
      getBaseKey(name)
    );
  }

  /********* remove stored value *********/

  function removeStoredValue(name) {
    const count =
      Number(
        getCookie(
          getCountKey(name)
        )
      );

    if (
      Number.isInteger(count) &&
      count > 0 &&
      count <= MAX_COOKIE_CHUNKS
    ) {
      for (
        let i = 0;
        i < count;
        i++
      ) {
        removeCookie(
          getChunkKey(
            name,
            i
          )
        );
      }
    }

    /*
     * Also remove possible
     * stale chunks.
     */
    for (
      let i = 0;
      i < MAX_COOKIE_CHUNKS;
      i++
    ) {
      removeCookie(
        getChunkKey(
          name,
          i
        )
      );
    }

    removeCookie(
      getCountKey(name)
    );

    removeCookie(
      getBaseKey(name)
    );
  }

  /********* write stored value *********/

  function setStoredValue(
    name,
    value
  ) {
    removeStoredValue(name);

    if (
      typeof value !==
        "string" ||
      value.length === 0
    ) {
      return;
    }

    /*
     * Prevent uncontrolled
     * cookie creation.
     */
    const chunks = [];

    for (
      let index = 0;
      index < value.length;
      index += COOKIE_CHUNK_SIZE
    ) {
      chunks.push(
        value.slice(
          index,
          index +
            COOKIE_CHUNK_SIZE
        )
      );

      if (
        chunks.length >
        MAX_COOKIE_CHUNKS
      ) {
        console.error(
          "[Scoutwave] Auth session is too large."
        );

        removeStoredValue(
          name
        );

        return;
      }
    }

    if (
      chunks.length === 1
    ) {
      setCookie(
        getBaseKey(name),
        chunks[0]
      );

      return;
    }

    chunks.forEach(
      (chunk, index) => {
        setCookie(
          getChunkKey(
            name,
            index
          ),
          chunk
        );
      }
    );

    setCookie(
      getCountKey(name),
      String(chunks.length)
    );
  }

  /********* shared auth storage *********/

  const sharedStorage = {
    getItem(key) {
      return getStoredValue(
        key
      );
    },

    setItem(
      key,
      value
    ) {
      setStoredValue(
        key,
        value
      );
    },

    removeItem(key) {
      removeStoredValue(
        key
      );
    },
  };

  /********* create Supabase client *********/

  const client =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          storage:
            sharedStorage,

          storageKey:
            STORAGE_KEY,

          persistSession:
            true,

          autoRefreshToken:
            true,

          detectSessionInUrl:
            true,

          flowType:
            "pkce",
        },
      }
    );

  /********* expose client *********/

  window.supabaseClient =
    client;

  window.__scoutwaveSupabaseClient =
    true;

  /********* auth events *********/

  const {
    data: authListener,
  } =
    client.auth.onAuthStateChange(
      (
        event,
        session
      ) => {
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