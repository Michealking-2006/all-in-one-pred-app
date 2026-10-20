import { h } from "./utils/h.js";
import { store, UNLOCK_COST } from "./store.js";
import { navigate, initRouter, goBack } from "./router.js";
import { showToast } from "./toast.js";
import { getAvatarSrc } from "./data/avatars.js";
import { BottomNav } from "./components/BottomNav.js";
import { HomeScreen } from "./components/HomeScreen.js";
import { SkeletonPage } from "./components/Skeleton.js";
import { supabase, initializeAuth } from "./api/supabase.js";
import { initNavBars, syncNavBars } from "./utils/navbar.js";
import { initTheme } from "./theme.js";
import { initThemeFx, activeFxTheme, fxThemeById, fxPriceOf } from "./themeFx.js";
import { initRemoteConfig, REMOTE_EVENT } from "./remoteConfig.js";
import { initUsageBeacon } from "./usageBeacon.js";
import { initPush } from "./push.js";
import { initEntitlements, serverMode, spendCoins, startCheckout, tipCost } from "./entitlements.js";
import { blockingNotice, blockingScreen, announcementBar } from "./components/RemoteNotices.js";
import { initClubTheme, clubById } from "./clubTheme.js";
import { initLiveAlerts } from "./liveAlerts.js";
import { applyRouteSeo } from "./seo.js";
import { initPerf } from "./perf.js";
import { initPwaMode } from "./pwaMode.js";
import { initPullToRefresh, setRefreshHandler } from "./pullToRefresh.js";

// Screens with free-text fields the user might be mid-typing into: a pull
// gesture there would rebuild the screen (via render()) and silently wipe
// whatever they'd entered, since these inputs are uncontrolled DOM nodes, not
// tracked in the store. Excluded from pull-to-refresh entirely.
const NO_REFRESH_TABS = new Set(["auth", "edit-profile", "change-password", "report-issue", "contact-us", "feedback"]);

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

  return h("main", { className: "screen", "aria-busy": "true" }, [SkeletonPage()]);
}

// Every sub-page reached from Profile (not a bottom-nav destination itself)
// still counts as "Profile" for the purpose of which nav icon lights up.
const PROFILE_SUBPAGES = [
  "favorites", "edit-profile", "change-password", "notifications",
  "help-centre", "report-issue", "feedback", "contact-us", "privacy-policy",
  "terms-of-use", "about", "language", "appearance", "themes", "premium", "coins", "avatar",
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
  subscribe: (plan) => {
    if (serverMode()) {
      showToast("Opening secure checkout…", "default", 3000);
      startCheckout(plan === "1m" ? "premium:1m" : "premium:12m").catch((error) => showToast(error.message || "Couldn't start the checkout", "error"));
      return;
    }
    store.setState({ isVip: true });
    showToast("Welcome to VIP — every tip is unlocked", "success");
    goBack("/profile");
  },
  buyCoins: (amount) => {
    if (serverMode()) {
      showToast("Opening secure checkout…", "default", 3000);
      startCheckout("coins:" + amount).catch((error) => showToast(error.message || "Couldn't start the checkout", "error"));
      return;
    }
    store.setState((state) => ({ coins: state.coins + amount }));
    showToast(`+${amount} coins added`, "success");
  },
  unlockWithCoins: (matchId) => {
    if (serverMode()) {
      spendCoins("tip:" + matchId)
        .then(() => showToast(`Tip unlocked for ${tipCost()} coins`, "success"))
        .catch((error) => showToast(error.message || "Couldn't unlock that tip", "error"));
      return;
    }
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
    });
  },
  // Silent: the calling component updates its own star, so favouriting never
  // re-renders the app (no scroll jump, no refetch). Returns the new state.
  // Silent: the calling row/button updates its own star in place (see
  // utils/ui.js's setStarState), so favouriting never re-renders the whole
  // app (no scroll jump, no refetch). Returns the new favourite state.
  toggleFavorite: (type, id) => {
    const { favorites } = store.getState();
    const list = favorites[type] || [];
    const isFav = list.includes(id);
    store.setState(
      { favorites: { ...favorites, [type]: isFav ? list.filter((x) => x !== id) : [...list, id] } },
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
  // Not silent: theme.js's store subscriber needs to run so the new theme is
  // applied immediately, and the Appearance screen needs to re-render so its
  // checkmark moves to the new choice.
  setTheme: (theme) => store.setState({ theme }),
  setPerfMode: (perfMode) => store.setState({ perfMode }),
  setClubTheme: (club) => {
    store.setState({ clubTheme: club ? { id: club.id, primary: club.primary } : null });
    showToast(club ? `${club.name || "Custom"} colours applied` : "Standard colours restored", "success");
  },
  applyFxTheme: (id) => {
    store.setState({ fxTheme: id });
    showToast(id ? `${fxThemeById(id)?.name} theme applied` : "Standard theme restored", "success");
  },
  unlockFxTheme: (id) => {
    const theme = fxThemeById(id);
    const state = store.getState();
    if (!theme || theme.vip || state.unlockedThemes.includes(id)) return;
    const price = fxPriceOf(theme);
    // On an account the server decides whether the balance covers it (this copy may be a few minutes old).
    if (!serverMode() && state.coins < price) {
      showToast(`Not enough coins for ${theme.name}`, "error");
      navigate("/coins");
      return;
    }
    if (serverMode()) {
      // The server checks the balance and charges; the new state comes back and is mirrored.
      spendCoins("theme:" + id)
        .then(() => { store.setState({ fxTheme: id }); showToast(`${theme.name} unlocked and applied`, "success"); })
        .catch((error) => showToast(error.message || `Couldn't unlock ${theme.name}`, "error"));
      return;
    }
    store.setState({ coins: state.coins - price, unlockedThemes: [...state.unlockedThemes, id], fxTheme: id });
    showToast(`${theme.name} unlocked and applied`, "success");
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
  const isFavorite = (type, id) => (state.favorites[type] || []).includes(id);
  const onBack = actions.closeSubpage;
  const avatarSrc = getAvatarSrc(state.avatarId);
  const signIn = () => actions.goTo("auth");

  let content;
  if (state.openFixtureId) {
    content = lazyScreen("MatchScreen", () => import("./components/MatchScreen.js"), {
      fixtureId: state.openFixtureId,
      matchTab: state.matchTab,
      onBack: actions.closeMatch,
      isFavorite: isFavorite("match", state.openFixtureId),
      onToggleFavorite: () => actions.toggleFavorite("match", state.openFixtureId),
      onTabChange: actions.setMatchTab,
    });
  } else if (state.openEntity) {
    const { type, id, slug } = state.openEntity;
    if (type === "league") content = lazyScreen("LeaguePage", () => import("./components/LeaguePage.js"), { id, onBack: actions.closeSubpage, isFavorite: isFavorite("league", id), onToggleFavorite: () => actions.toggleFavorite("league", id) });
    else if (type === "league-slug") content = lazyScreen("LeaguePage", () => import("./components/LeaguePage.js"), { slug, onBack: actions.closeSubpage });
    else if (type === "club") content = lazyScreen("ClubPage", () => import("./components/ClubPage.js"), { id, onBack: actions.closeSubpage, isFavorite: isFavorite("club", id), onToggleFavorite: () => actions.toggleFavorite("club", id) });
    else if (type === "venue") content = lazyScreen("VenuePage", () => import("./components/VenuePage.js"), { id, onBack: actions.closeSubpage, isFavorite: isFavorite("venue", id), onToggleFavorite: () => actions.toggleFavorite("venue", id) });
    else if (type === "article") content = lazyScreen("ArticlePage", () => import("./components/ArticlePage.js"), { id, onBack: () => goBack("/news") });
    else if (type === "player") content = lazyScreen("PlayerPage", () => import("./components/PlayerPage.js"), { id, onBack: actions.closeSubpage, isFavorite: isFavorite("player", id), onToggleFavorite: () => actions.toggleFavorite("player", id) });
  } else if (state.tab === "auth") {
    content = lazyScreen("AuthScreen", () => import("./components/AuthScreen.js"), { mode: state.authMode || "login" });
  } else if (state.tab === "home") {
    content = HomeScreen({
      onOpenMatch: actions.openMatch,
      favoriteMatchIds: state.favorites.match,
      onToggleFavorite: (id) => actions.toggleFavorite("match", id),
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
    content = lazyScreen("FavoritesScreen", () => import("./components/FavoritesScreen.js"), {
      favorites: state.favorites,
      onToggleFavorite: actions.toggleFavorite,
      onOpenMatch: actions.openMatch,
      // FavoritesScreen already has each entity's id/name (needed to render
      // the row anyway), so it builds the correct "/type/id-slug" path itself
      // via buildSlug and just hands the finished path back here.
      onOpenEntity: (path) => navigate(path),
      onBack,
    });
  } else if (state.tab === "edit-profile") {
    content = lazyScreen("EditProfileScreen", () => import("./components/EditProfileScreen.js"), { onBack, avatarSrc, onChooseAvatar: actions.openAvatarPicker, authUser: state.authUser, onSaveName: actions.saveDisplayName, onSignIn: signIn });
  } else if (state.tab === "avatar") {
    content = lazyScreen("AvatarPickerScreen", () => import("./components/AvatarPickerScreen.js"), { current: state.avatarId, onSelect: actions.setAvatar, onBack });
  } else if (state.tab === "change-password") {
    content = lazyScreen("ChangePasswordScreen", () => import("./components/ChangePasswordScreen.js"), { onBack, authUser: state.authUser, onSignIn: signIn });
  } else if (state.tab === "news") {
    content = lazyScreen("NewsScreen", () => import("./components/NewsScreen.js"));
  } else if (state.tab === "notifications") {
    content = lazyScreen("NotificationsScreen", () => import("./components/NotificationsScreen.js"), { prefs: state.notificationPrefs, onTogglePref: actions.toggleNotificationPref, onBack });
  } else if (state.tab === "help-centre") {
    content = lazyScreen("HelpCentreScreen", () => import("./components/HelpCentreScreen.js"), { onBack });
  } else if (state.tab === "report-issue") {
    content = lazyScreen("ReportIssueScreen", () => import("./components/ReportIssueScreen.js"), { onBack, authUser: state.authUser });
  } else if (state.tab === "feedback") {
    content = lazyScreen("FeedbackScreen", () => import("./components/FeedbackScreen.js"), { onBack, authUser: state.authUser });
  } else if (state.tab === "contact-us") {
    content = lazyScreen("ContactUsScreen", () => import("./components/ContactUsScreen.js"), { onBack, authUser: state.authUser });
  } else if (state.tab === "privacy-policy") {
    content = lazyScreen("PrivacyPolicyScreen", () => import("./components/PrivacyPolicyScreen.js"), { onBack });
  } else if (state.tab === "terms-of-use") {
    content = lazyScreen("TermsOfUseScreen", () => import("./components/TermsOfUseScreen.js"), { onBack });
  } else if (state.tab === "about") {
    content = lazyScreen("AboutScreen", () => import("./components/AboutScreen.js"), { onBack });
  } else if (state.tab === "language") {
    content = lazyScreen("LanguageScreen", () => import("./components/LanguageScreen.js"), { current: state.language, onSelect: actions.setLanguage, onBack });
  } else if (state.tab === "appearance") {
    content = lazyScreen("AppearanceScreen", () => import("./components/AppearanceScreen.js"), { current: state.theme, club: state.clubTheme, perfMode: state.perfMode, onPerfMode: actions.setPerfMode, fxActive: fxThemeById(activeFxTheme(state))?.name || "", onSelect: actions.setTheme, onSelectClub: actions.setClubTheme, onBack });
  } else if (state.tab === "themes") {
    content = lazyScreen("ThemesScreen", () => import("./components/ThemesScreen.js"), {
      coins: state.coins,
      isVip: state.isVip,
      unlocked: state.unlockedThemes,
      active: activeFxTheme(state),
      onApply: actions.applyFxTheme,
      onUnlock: actions.unlockFxTheme,
      onOpenPremium: actions.openPremium,
      onOpenCoins: actions.openCoins,
      onBack,
    });
  } else if (state.tab === "premium") {
    content = lazyScreen("PremiumScreen", () => import("./components/PremiumScreen.js"), { isVip: state.isVip, live: serverMode(), onSubscribe: actions.subscribe, onOpenThemes: () => actions.goTo("themes"), onBack });
  } else if (state.tab === "coins") {
    content = lazyScreen("CoinsScreen", () => import("./components/CoinsScreen.js"), { coins: state.coins, live: serverMode(), onBuy: actions.buyCoins, onBack });
  } else {
    content = lazyScreen("ProfileScreen", () => import("./components/ProfileScreen.js"), {
      isVip: state.isVip,
      coins: state.coins,
      favoritesCount: Object.values(state.favorites).reduce((sum, list) => sum + list.length, 0),
      onOpenFavorites: actions.openFavorites,
      onRequestUpgrade: actions.openPremium,
      onOpenCoins: actions.openCoins,
      currentLanguage: state.language,
      theme: state.theme,
      fxThemeName: fxThemeById(activeFxTheme(state))?.name || "",
      clubName: state.clubTheme ? (clubById(state.clubTheme.id)?.name || "Custom") : "",
      onNavigate: actions.goTo,
      avatarSrc,
      authUser: state.authUser,
      onOpenAuth: signIn,
      onSignOut: actions.signOut,
    });
  }

  const inEntity = state.openFixtureId || state.openEntity;
  // Match pages belong to Games; league / club / player / venue pages belong to Leagues.
  const navActive = state.openFixtureId ? "home"
    : state.openEntity?.type === "article" ? "news"
    : state.openEntity ? "leagues"
    : PROFILE_SUBPAGES.includes(state.tab) || state.tab === "search" ? (state.tab === "search" ? "home" : "profile")
    : state.tab;

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
  const sameRoute = key === lastRouteKey;
  const scrollY = sameRoute ? window.scrollY : 0;
  lastRouteKey = key;
  try {
    root.innerHTML = "";
    // Maintenance mode / "update required" (set from the admin dashboard) replace the whole app.
    const blocking = blockingNotice();
    if (blocking) {
      root.appendChild(blockingScreen(blocking, render));
      window.__scoutwaveBooted = true;
      return;
    }
    const app = App(state);
    const banner = announcementBar(render);
    if (banner) app.prepend(banner);
    root.appendChild(app);
    window.scrollTo(0, scrollY);
    lastRenderError = null;
    window.__scoutwaveBooted = true;
    syncNavBars();
    applyRouteSeo(); // URL-derived defaults; match and league pages refine this once loaded
    // Forms get a soft refresh (caches only) so a pull never wipes typed text.
    setRefreshHandler(NO_REFRESH_TABS.has(state.tab) ? () => {} : () => render());
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
window.addEventListener(REMOTE_EVENT, render); // flags, banner or maintenance changed from the admin dashboard

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "AUTH_ERROR") {
    showToast(session?.message || "That link is invalid or has expired.", "error", 4500);
    return;
  }
  store.setState({ authUser: session?.user || null });
});

// Runs synchronously up to its first await, so any #access_token fragment from
// Google / e-mail links is consumed before the router reads the URL.
initNavBars();
initPwaMode();
initPullToRefresh();
initTheme();
initPerf();
initRemoteConfig();
initEntitlements();
initUsageBeacon();
initPush();
initClubTheme();
initThemeFx();
initLiveAlerts();
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
