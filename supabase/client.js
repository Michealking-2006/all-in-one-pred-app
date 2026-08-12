(() => {
  if (window.__scoutwaveSupabaseClient) {
    return;
  }

  /********* configuration *********/

  const SUPABASE_URL =
    "https://fhsteyglvxuanyvgkkxp.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_l-EwBR_dCGpxDo_87GC1HA_1COYjj3W";

  const COOKIE_DOMAIN = ".myscoutwave.com";
  const COOKIE_PREFIX = "scoutwave-sb";

  const COOKIE_MAX_AGE =
    60 * 60 * 24 * 365;

  const COOKIE_CHUNK_SIZE = 3000;

  const STORAGE_KEY = "scoutwave-auth";

  /********* cookie helpers *********/

  function escapeRegExp(value) {
    return String(value).replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
  }

  function encode(value) {
    return encodeURIComponent(value);
  }

  function decode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function getCookie(name) {
    const cookieName = encode(name);

    const match = document.cookie.match(
      new RegExp(
        `(?:^|;\\s*)${escapeRegExp(cookieName)}=([^;]*)`
      )
    );

    return match ? decode(match[1]) : null;
  }

  function setCookie(
    name,
    value,
    maxAge = COOKIE_MAX_AGE
  ) {
    document.cookie =
      `${encode(name)}=${encode(value)};` +
      `Path=/;` +
      `Domain=${COOKIE_DOMAIN};` +
      `Max-Age=${maxAge};` +
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

  /********* storage helpers *********/

  function getCountKey(name) {
    return `${COOKIE_PREFIX}-${name}-count`;
  }

  function getValueKey(name) {
    return `${COOKIE_PREFIX}-${name}`;
  }

  function getChunkKey(name, index) {
    return `${COOKIE_PREFIX}-${name}-${index}`;
  }

  function getStoredValue(name) {
    const countValue =
      getCookie(getCountKey(name));

    const count = Number(countValue);

    if (
      Number.isInteger(count) &&
      count > 0
    ) {
      let value = "";

      for (let i = 0; i < count; i++) {
        const chunk = getCookie(
          getChunkKey(name, i)
        );

        if (chunk === null) {
          return null;
        }

        value += chunk;
      }

      return value;
    }

    return getCookie(
      getValueKey(name)
    );
  }

  function removeStoredValue(name) {
    const countValue =
      getCookie(getCountKey(name));

    const count = Number(countValue);

    if (
      Number.isInteger(count) &&
      count > 0
    ) {
      for (let i = 0; i < count; i++) {
        removeCookie(
          getChunkKey(name, i)
        );
      }
    }

    removeCookie(
      getCountKey(name)
    );

    removeCookie(
      getValueKey(name)
    );
  }

  function setStoredValue(name, value) {
    removeStoredValue(name);

    if (
      typeof value !== "string" ||
      value.length === 0
    ) {
      return;
    }

    if (
      value.length <=
      COOKIE_CHUNK_SIZE
    ) {
      setCookie(
        getValueKey(name),
        value
      );

      return;
    }

    const chunks = [];

    for (
      let index = 0;
      index < value.length;
      index += COOKIE_CHUNK_SIZE
    ) {
      chunks.push(
        value.slice(
          index,
          index + COOKIE_CHUNK_SIZE
        )
      );
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
      return getStoredValue(key);
    },

    setItem(key, value) {
      setStoredValue(key, value);
    },

    removeItem(key) {
      removeStoredValue(key);
    },
  };

  /********* supabase availability *********/

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

  /********* create client *********/

  const client =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          storage: sharedStorage,

          storageKey: STORAGE_KEY,

          persistSession: true,

          autoRefreshToken: true,

          detectSessionInUrl: true,

          flowType: "pkce",
        },
      }
    );

  /********* expose client *********/

  window.supabaseClient = client;

  window.__scoutwaveSupabaseClient = true;

  /********* auth state *********/

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
                session?.user || null,
            },
          }
        )
      );
    }
  );
})();