const SUPABASE_URL = "https://fhsteyglvxuanyvgkkxp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_l-EwBR_dCGpxDo_87GC1HA_1COYjj3W";
const SESSION_KEY = "scoutwave.supabase.session.v1";

const listeners = new Set();

function consumeOAuthSession() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken) return false;
  const expiresIn = Number(params.get("expires_in") || 3600);
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken || "",
    token_type: params.get("token_type") || "bearer",
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  };
  writeSession(session);
  emit("SIGNED_IN", session);
  history.replaceState(history.state, document.title, window.location.pathname + window.location.search);
  return true;
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
  } catch {
    writeSession(null);
    emit("SIGNED_OUT", null);
    return null;
  }
}

async function currentUser() {
  let session = readSession();
  if (!session?.access_token) return null;

  if (session.expires_at && Date.now() / 1000 >= Number(session.expires_at) - 30) {
    session = await refreshSession(session);
    if (!session?.access_token) return null;
  }

  try {
    return await request("/auth/v1/user", { accessToken: session.access_token });
  } catch (error) {
    if (error.status === 401 && session.refresh_token) {
      const refreshed = await refreshSession(session);
      if (!refreshed?.access_token) return null;
      return request("/auth/v1/user", { accessToken: refreshed.access_token });
    }
    return null;
  }
}

export async function initializeAuth() {
  return consumeOAuthSession();
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

    async signUp({ email, password }) {
      try {
        const data = await request("/auth/v1/signup", {
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

    async resetPasswordForEmail(email, options = {}) {
      try {
        const body = { email };
        if (options.redirectTo) body.redirect_to = options.redirectTo;
        await request("/auth/v1/recover", { method: "POST", body });
        return { data: {}, error: null };
      } catch (error) {
        return { data: null, error };
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
  if (/password/i.test(message) && /characters|length|weak|8/i.test(message)) return "Choose a stronger password with at least 8 characters.";
  if (/rate limit|too many requests/i.test(message)) return "Too many attempts. Please try again later.";
  return message || "Something went wrong. Please try again.";
}
