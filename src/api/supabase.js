const SUPABASE_URL = "https://fhsteyglvxuanyvgkkxp.supabase.co";
// Publishable (anon) key: safe to ship in the browser as long as Row Level
// Security is enabled on every table.
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_l-EwBR_dCGpxDo_87GC1HA_1COYjj3W";
const SESSION_KEY = "scoutwave.supabase.session.v1";

const listeners = new Set();

// Handles the URL fragment Supabase appends after Google sign-in, e-mail
// confirmation and password-recovery links. Returns what it found.
function consumeAuthRedirect() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (!hash) return { consumed: false };
  const params = new URLSearchParams(hash);

  const errorDescription = params.get("error_description");
  if (params.get("error") || errorDescription) {
    history.replaceState(history.state, document.title, window.location.pathname + window.location.search);
    const message = /expired|invalid/i.test(errorDescription || "")
      ? "That link is invalid or has expired. Please request a new one."
      : (errorDescription || "Sign-in failed. Please try again.").replace(/\+/g, " ");
    emit("AUTH_ERROR", { message });
    return { consumed: true, error: message };
  }

  const accessToken = params.get("access_token");
  if (!accessToken) return { consumed: false };

  const expiresIn = Number(params.get("expires_in") || 3600);
  const session = {
    access_token: accessToken,
    refresh_token: params.get("refresh_token") || "",
    token_type: params.get("token_type") || "bearer",
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  };
  writeSession(session);
  const recovery = params.get("type") === "recovery";
  emit(recovery ? "PASSWORD_RECOVERY" : "SIGNED_IN", session);
  history.replaceState(history.state, document.title, window.location.pathname + window.location.search);
  return { consumed: true, recovery };
}

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session && session.access_token ? session : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  try {
    if (session?.access_token) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

function emit(event, session) {
  listeners.forEach((listener) => {
    try { listener(event, session); } catch {}
  });
}

async function request(path, { method = "GET", body, accessToken } = {}) {
  const response = await fetch(SUPABASE_URL + path, {
    method,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: "Bearer " + (accessToken || SUPABASE_PUBLISHABLE_KEY),
      "Content-Type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.msg ||
      data?.message ||
      data?.error_description ||
      data?.error ||
      "Authentication request failed."
    );
    error.status = response.status;
    error.code = data?.code || data?.error_code;
    throw error;
  }

  return data;
}

// Only a definitive rejection (invalid/used refresh token) signs the user out.
// A network hiccup keeps the stored session so being offline never logs anyone out.
async function refreshSession(session) {
  if (!session?.refresh_token) return null;

  try {
    const data = await request("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: session.refresh_token },
    });
    writeSession(data);
    emit("TOKEN_REFRESHED", data);
    return data;
  } catch (error) {
    if (error.status === 400 || error.status === 401 || error.status === 403) {
      writeSession(null);
      emit("SIGNED_OUT", null);
    }
    return null;
  }
}

// Returns a session whose access token is not about to expire, or null.
async function validSession() {
  const session = readSession();
  if (!session?.access_token) return null;
  const expiring = session.expires_at && Date.now() / 1000 >= Number(session.expires_at) - 30;
  return expiring ? refreshSession(session) : session;
}

async function currentUser() {
  const stored = readSession();
  if (!stored) return null;

  const session = await validSession();
  // Refresh failed: either the session was cleared (signed out) or we are
  // offline, in which case the cached user is still the right answer.
  if (!session) return readSession()?.user || null;

  try {
    return await request("/auth/v1/user", { accessToken: session.access_token });
  } catch (error) {
    if (error.status === 401) {
      const refreshed = await refreshSession(session);
      if (!refreshed?.access_token) return null;
      try {
        return await request("/auth/v1/user", { accessToken: refreshed.access_token });
      } catch {
        return refreshed.user || null;
      }
    }
    return session.user || null;
  }
}

function withRedirect(path, redirectTo) {
  return redirectTo ? path + (path.includes("?") ? "&" : "?") + "redirect_to=" + encodeURIComponent(redirectTo) : path;
}

export async function initializeAuth() {
  return consumeAuthRedirect();
}

export const supabase = {
  auth: {
    async getUser() {
      return { data: { user: await currentUser() }, error: null };
    },

    async signInWithOAuth({ provider, options = {} }) {
      if (provider !== "google") return { data: null, error: new Error("This sign-in provider is not available.") };
      const redirectTo = options.redirectTo || window.location.origin + "/auth";
      const url = new URL(SUPABASE_URL + "/auth/v1/authorize");
      url.searchParams.set("provider", "google");
      url.searchParams.set("redirect_to", redirectTo);
      window.location.assign(url.toString());
      return { data: { url: url.toString(), provider: "google" }, error: null };
    },

    async signInWithPassword({ email, password }) {
      try {
        const data = await request("/auth/v1/token?grant_type=password", {
          method: "POST",
          body: { email, password },
        });
        writeSession(data);
        emit("SIGNED_IN", data);
        return { data: { session: data, user: data?.user || null }, error: null };
      } catch (error) {
        return { data: { session: null, user: null }, error };
      }
    },

    async signUp({ email, password, options = {} }) {
      try {
        const data = await request(withRedirect("/auth/v1/signup", options.emailRedirectTo), {
          method: "POST",
          body: { email, password },
        });
        if (data?.access_token) {
          writeSession(data);
          emit("SIGNED_IN", data);
        }
        return { data: { session: data?.access_token ? data : null, user: data?.user || null }, error: null };
      } catch (error) {
        return { data: { session: null, user: null }, error };
      }
    },

    // Re-sends the confirmation e-mail for a sign-up that is still unconfirmed.
    async resend({ type = "signup", email, options = {} }) {
      try {
        await request(withRedirect("/auth/v1/resend", options.emailRedirectTo), { method: "POST", body: { type, email } });
        return { data: {}, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async resetPasswordForEmail(email, options = {}) {
      try {
        // GoTrue reads the redirect target from the query string, not the body.
        await request(withRedirect("/auth/v1/recover", options.redirectTo), { method: "POST", body: { email } });
        return { data: {}, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    // updateUser({ password }) or updateUser({ data: { full_name } })
    async updateUser(attributes) {
      const session = await validSession();
      if (!session) return { data: { user: null }, error: new Error("Auth session missing. Please sign in again.") };
      try {
        const user = await request("/auth/v1/user", { method: "PUT", body: attributes, accessToken: session.access_token });
        writeSession({ ...readSession(), user });
        emit("USER_UPDATED", { ...readSession(), user });
        return { data: { user }, error: null };
      } catch (error) {
        return { data: { user: null }, error };
      }
    },

    async signOut() {
      const session = readSession();
      try {
        if (session?.access_token) {
          await request("/auth/v1/logout", { method: "POST", accessToken: session.access_token });
        }
      } catch {}
      writeSession(null);
      emit("SIGNED_OUT", null);
      return { error: null };
    },

    onAuthStateChange(callback) {
      listeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe() {
              listeners.delete(callback);
            },
          },
        },
      };
    },
  },
};

export function authErrorMessage(error) {
  const message = String(error?.message || "");
  if (/invalid login credentials|invalid credentials/i.test(message)) return "The email or password is incorrect.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email address before signing in.";
  if (/already registered|already exists|user already registered/i.test(message)) return "An account with this email already exists.";
  if (/different from the old|same as the old|same password/i.test(message)) return "Choose a password different from your current one.";
  if (/session missing|session_not_found|not authenticated/i.test(message)) return "Your session has expired. Please sign in again.";
  if (/password/i.test(message) && /characters|length|weak|8/i.test(message)) return "Choose a stronger password with at least 8 characters.";
  if (/rate limit|too many requests/i.test(message)) return "Too many attempts. Please try again later.";
  if (/failed to fetch|networkerror|load failed/i.test(message)) return "Couldn't reach the server. Check your connection and try again.";
  return message || "Something went wrong. Please try again.";
}
