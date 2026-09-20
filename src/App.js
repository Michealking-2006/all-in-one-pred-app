import { h } from "./utils/h.js";
import { store, UNLOCK_COST } from "./store.js";
import { navigate, initRouter, goBack } from "./router.js";
import { showToast } from "./toast.js";
import { getAvatarSrc } from "./data/avatars.js";
import { BottomNav } from "./components/BottomNav.js";
import { HomeScreen } from "./components/HomeScreen.js";
import { supabase, initializeAuth } from "./api/supabase.js";

const lazyModules = new Map();
const lazyPromises = new Map();
const lazyErrors = new Map();

function lazyScreen(key, loader, props = {}) {
  const loaded = lazyModules.get(key);
  if (loaded) return loaded(props);

  const error = lazyErrors.get(key);
  if (error) {
    return h("main", { className: "screen app-error-screen" }, [
      h("div", { className: "app-error-card card" }, [
        h("h1", {}, "This screen could not load"),
        h("p", {}, "A page module failed to load. Check your connection and try again."),
        h("button", { className: "primary-button", onClick: () => { lazyErrors.delete(key); render(); } }, "Try again"),
        h("button", { className: "secondary-button", onClick: () => navigate("/") }, "Back to Games"),
      ]),
    ]);
  }

  if (!lazyPromises.has(key)) {
    const promise = loader()
      .then((module) => {
        const component = module[key];
        if (typeof component !== "function") throw new Error("Missing screen export: " + key);
        lazyModules.set(key, component);
        return component;
      })
      .catch((loadError) => {
        lazyErrors.set(key, loadError);
        console.error("Scoutwave screen load error:", key, loadError);
        return null;
      })
      .finally(() => lazyPromises.delete(key));

    lazyPromises.set(key, promise);
    promise.then(() => render());
  }

  return h("main", { className: "screen detail-screen" }, [
    h("div", { className: "detail-panel" }, [
      h("div", { className: "skeleton", style: { width: "45%", height: "18px", marginBottom: "12px", borderRadius: "6px" } }),
      h("div", { className: "skeleton", style: { width: "100%", height: "110px", borderRadius: "14px" } }),
    ]),
  ]);
}

// Every sub-page reached from Profile (not a bottom-nav destination itself)
// still counts as "Profile" for the purpose of which nav icon lights up.
const PROFILE_SUBPAGES = [
  "favorites", "edit-profile", "change-password", "news", "notifications",
  "help-centre", "report-issue", "contact-us", "privacy-policy",
  "terms-of-use", "about", "language", "premium", "coins", "avatar",
];

// Actions — the only functions that touch the store or the URL. Components
// never call store.setState or history directly, they receive these as
// props/callbacks.
const actions = {
  goTab: (tab) => navigate(`/${tab}`),
  goTo: (route) => navigate(`/${route}`),
  openMatch: (id) => navigate(`/match/${id}`),
  openFavorites: () => navigate("/favorites"),
  openPremium: () => navigate("/premium"),
  openCoins: () => navigate("/coins"),
  openAvatarPicker: () => navigate("/avatar"),
  closeMatch: () => goBack("/"),
  // Profile sub-pages fall back to Profile (not Home) when opened via a direct link.
  closeSubpage: () => goBack(PROFILE_SUBPAGES.includes(store.getState().tab) ? "/profile" : "/"),
  subscribe: () => {
    store.setState({ isVip: true });
    showToast("Welcome to VIP — every tip is unlocked", "success");
    goBack("/profile");
  },
  buyCoins: (amount) => {
    store.setState((state) => ({ coins: state.coins + amount }));
    showToast(`+${amount} coins added`, "success");
  },
  unlockWithCoins: (matchId) =>
    store.setState((state) => {
      if (state.unlockedMatchIds.includes(matchId)) return {};
      if (state.coins < UNLOCK_COST) {
        showToast("Not enough coins for that tip", "error");
        return {};
      }
      showToast(`Tip unlocked for ${UNLOCK_COST} coins`, "success");
      return {
        coins: state.coins - UNLOCK_COST,
        unlockedMatchIds: [...state.unlockedMatchIds, matchId],
      };
    }),
  // Silent: the calling component updates its own star, so favouriting never
  // re-renders the app (no scroll jump, no refetch). Returns the new state.
  toggleFavorite: (matchId) => {
    const { favoriteMatchIds } = store.getState();
    const isFav = favoriteMatchIds.includes(matchId);
    store.setState(
      { favoriteMatchIds: isFav ? favoriteMatchIds.filter((id) => id !== matchId) : [...favoriteMatchIds, matchId] },
      { silent: true }
    );
    showToast(isFav ? "Removed from favourites" : "Added to favourites");
    return !isFav;
  },
  setMatchTab: (matchTab) => store.setState({ matchTab }, { silent: true }),
  selectDay: (offset) => store.setState({ selectedDayOffset: offset }),
  toggleNotificationPref: (key) =>
    store.setState((state) => ({ notificationPrefs: { ...state.notificationPrefs, [key]: !state.notificationPrefs[key] } })),
  setLanguage: (lang) => {
    store.setState({ language: lang });
    showToast(`Language set to ${lang}`);
  },
  saveDisplayName: async (name) => {
    const { data, error } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (error) throw error;
    store.setState({ authUser: data.user });
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) showToast("Unable to sign out right now", "error");
    else { store.setState({ authUser: null }); navigate("/"); }
  },
  setAvatar: (avatarId) => {
    store.setState({ avatarId });
    showToast("Avatar updated", "success");
    goBack("/profile");
  },
};

function App(state) {
  const isUnlocked = (matchId) => state.isVip || state.unlockedMatchIds.includes(matchId);
  const onBack = actions.closeSubpage;
  const avatarSrc = getAvatarSrc(state.avatarId);
  const signIn = () => actions.goTo("auth");

  let content;
  if (state.openFixtureId) {
    content = lazyScreen("MatchScreen", () => import("./components/MatchScreen.js"), {
      fixtureId: state.openFixtureId,
      matchTab: state.matchTab,
      onBack: actions.closeMatch,
      isFavorite: state.favoriteMatchIds.includes(state.openFixtureId),
      onToggleFavorite: () => actions.toggleFavorite(state.openFixtureId),
      onTabChange: actions.setMatchTab,
    });
  } else if (state.openEntity) {
    const { type, id, slug } = state.openEntity;
    if (type === "league") content = lazyScreen("LeaguePage", () => import("./components/LeaguePage.js"), { id, onBack: actions.closeSubpage });
    else if (type === "league-slug") content = lazyScreen("LeaguePage", () => import("./components/LeaguePage.js"), { slug, onBack: actions.closeSubpage });
    else if (type === "club") content = lazyScreen("ClubPage", () => import("./components/ClubPage.js"), { id, onBack: actions.closeSubpage });
    else if (type === "venue") content = lazyScreen("VenuePage", () => import("./components/VenuePage.js"), { id, onBack: actions.closeSubpage });
    else if (type === "player") content = lazyScreen("PlayerPage", () => import("./components/PlayerPage.js"), { id, onBack: actions.closeSubpage });
  } else if (state.tab === "auth") {
    content = lazyScreen("AuthScreen", () => import("./components/AuthScreen.js"), { mode: state.authMode || "login" });
  } else if (state.tab === "home") {
    content = HomeScreen({
      onOpenMatch: actions.openMatch,
      favoriteMatchIds: state.favoriteMatchIds,
      onToggleFavorite: actions.toggleFavorite,
      selectedDayOffset: state.selectedDayOffset,
      onSelectDay: actions.selectDay,
      onOpenProfile: () => actions.goTab("profile"),
      onOpenSearch: () => actions.goTo("search"),
    });
  } else if (state.tab === "leagues") {
    content = lazyScreen("LeaguesScreen", () => import("./components/LeaguesScreen.js"));
  } else if (state.tab === "search") {
    content = lazyScreen("SearchScreen", () => import("./components/SearchScreen.js"), { onBack: actions.closeSubpage });
  } else if (state.tab === "vip") {
    content = lazyScreen("VipTipsScreen", () => import("./components/VipTipsScreen.js"), { isVip: state.isVip, isUnlocked });
  } else if (state.tab === "favorites") {
    content = lazyScreen("FavoritesScreen", () => import("./components/FavoritesScreen.js"), { favoriteMatchIds: state.favoriteMatchIds, onToggleFavorite: actions.toggleFavorite, onOpenMatch: actions.openMatch, onBack });
  } else if (state.tab === "edit-profile") {
    content = lazyScreen("EditProfileScreen", () => import("./components/EditProfileScreen.js"), { onBack, avatarSrc, onChooseAvatar: actions.openAvatarPicker, authUser: state.authUser, onSaveName: actions.saveDisplayName, onSignIn: signIn });
  } else if (state.tab === "avatar") {
    content = lazyScreen("AvatarPickerScreen", () => import("./components/AvatarPickerScreen.js"), { current: state.avatarId, onSelect: actions.setAvatar, onBack });
  } else if (state.tab === "change-password") {
    content = lazyScreen("ChangePasswordScreen", () => import("./components/ChangePasswordScreen.js"), { onBack, authUser: state.authUser, onSignIn: signIn });
  } else if (state.tab === "news") {
    content = lazyScreen("NewsScreen", () => import("./components/NewsScreen.js"), { onBack });
  } else if (state.tab === "notifications") {
    content = lazyScreen("NotificationsScreen", () => import("./components/NotificationsScreen.js"), { prefs: state.notificationPrefs, onTogglePref: actions.toggleNotificationPref, onBack });
  } else if (state.tab === "help-centre") {
    content = lazyScreen("HelpCentreScreen", () => import("./components/HelpCentreScreen.js"), { onBack });
  } else if (state.tab === "report-issue") {
    content = lazyScreen("ReportIssueScreen", () => import("./components/ReportIssueScreen.js"), { onBack });
  } else if (state.tab === "contact-us") {
    content = lazyScreen("ContactUsScreen", () => import("./components/ContactUsScreen.js"), { onBack });
  } else if (state.tab === "privacy-policy") {
    content = lazyScreen("PrivacyPolicyScreen", () => import("./components/PrivacyPolicyScreen.js"), { onBack });
  } else if (state.tab === "terms-of-use") {
    content = lazyScreen("TermsOfUseScreen", () => import("./components/TermsOfUseScreen.js"), { onBack });
  } else if (state.tab === "about") {
    content = lazyScreen("AboutScreen", () => import("./components/AboutScreen.js"), { onBack });
  } else if (state.tab === "language") {
    content = lazyScreen("LanguageScreen", () => import("./components/LanguageScreen.js"), { current: state.language, onSelect: actions.setLanguage, onBack });
  } else if (state.tab === "premium") {
    content = lazyScreen("PremiumScreen", () => import("./components/PremiumScreen.js"), { isVip: state.isVip, onSubscribe: actions.subscribe, onBack });
  } else if (state.tab === "coins") {
    content = lazyScreen("CoinsScreen", () => import("./components/CoinsScreen.js"), { coins: state.coins, onBuy: actions.buyCoins, onBack });
  } else {
    content = lazyScreen("ProfileScreen", () => import("./components/ProfileScreen.js"), {
      isVip: state.isVip,
      coins: state.coins,
      favoritesCount: state.favoriteMatchIds.length,
      onOpenFavorites: actions.openFavorites,
      onRequestUpgrade: actions.openPremium,
      onOpenCoins: actions.openCoins,
      currentLanguage: state.language,
      onNavigate: actions.goTo,
      avatarSrc,
      authUser: state.authUser,
      onOpenAuth: signIn,
      onSignOut: actions.signOut,
    });
  }

  const inEntity = state.openFixtureId || state.openEntity;
  const navActive = PROFILE_SUBPAGES.includes(state.tab) ? "profile" : state.tab;

  return h("div", { className: "app-shell" }, [
    content,
    state.tab === "auth" && !inEntity ? null : BottomNav({ active: navActive, onChange: actions.goTab }),
  ]);
}

// Identifies "the same screen" so a re-render keeps the scroll position instead
// of jumping to the top.
function routeKey(s) {
  const entity = s.openEntity ? s.openEntity.type + ":" + (s.openEntity.id ?? s.openEntity.slug) : "";
  return [s.tab, s.authMode, s.openFixtureId, entity, s.selectedDayOffset].join("|");
}

let lastRenderError = null;
let lastRouteKey = null;

function render() {
  const root = document.getElementById("root");
  if (!root) return;
  const state = store.getState();
  const key = routeKey(state);
  const scrollY = key === lastRouteKey ? window.scrollY : 0;
  lastRouteKey = key;
  try {
    root.innerHTML = "";
    root.appendChild(App(state));
    window.scrollTo(0, scrollY);
    lastRenderError = null;
    window.__scoutwaveBooted = true;
  } catch (error) {
    console.error("Scoutwave render error:", error);
    if (lastRenderError === error) return;
    lastRenderError = error;
    root.innerHTML = "";
    root.appendChild(h("main", { className: "screen app-error-screen" }, [
      h("div", { className: "app-error-card card" }, [
        h("div", { className: "app-error-icon" }, [h("i", { "data-lucide": "triangle-alert" })]),
        h("h1", {}, "Something went wrong"),
        h("p", {}, "This screen could not be displayed. Your saved favourites are still safe."),
        h("button", { className: "primary-button", onClick: () => window.location.reload() }, "Reload app"),
      ]),
    ]));
  }
}

// A signed-in user has no business on the sign-in / sign-up screens (e.g. after
// returning from Google). Password reset and "set new password" stay reachable.
function guardAuthRoute(state) {
  if (state.tab === "auth" && state.authUser && (state.authMode === "login" || state.authMode === "signup")) {
    navigate("/", { replace: true });
  }
}

store.subscribe(guardAuthRoute);
store.subscribe(render);

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "AUTH_ERROR") {
    showToast(session?.message || "That link is invalid or has expired.", "error", 4500);
    return;
  }
  store.setState({ authUser: session?.user || null });
});

// Runs synchronously up to its first await, so any #access_token fragment from
// Google / e-mail links is consumed before the router reads the URL.
const authBoot = initializeAuth();
initRouter();
// setState skips notifying when nothing changed (e.g. a fresh load on "/"),
// so the first paint must be explicit.
render();

authBoot
  .then(async (result) => {
    if (result?.recovery) navigate("/auth/update", { replace: true });
    const { data } = await supabase.auth.getUser();
    store.setState({ authUser: data?.user || null });
  })
  .catch(() => {});

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Service worker not registered:", error));
  });
}
