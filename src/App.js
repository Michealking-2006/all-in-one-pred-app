import { h } from "./utils/h.js";
import { store, UNLOCK_COST } from "./store.js";
import { navigate, initRouter } from "./router.js";
import { showToast } from "./toast.js";
import { matches } from "./data/mockData.js";
import { getAvatarSrc } from "./data/avatars.js";
import { BottomNav } from "./components/BottomNav.js";
import { HomeScreen } from "./components/HomeScreen.js";
import { supabase } from "./api/supabase.js";

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
        h("p", {}, "A page module failed to load. Return to Games and continue using the app."),
        h("button", { className: "primary-button", onClick: () => navigate("/") }, "Back to Games"),
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
        lazyPromises.delete(key);
        console.error("Scoutwave screen load error:", key, loadError);
        return null;
      });

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
// never call store.setState or location.hash directly, they receive these
// as props/callbacks. Route fields (tab, openMatchId, matchTab-on-new-match)
// are driven by router.js via navigate(); everything else is plain setState.
const actions = {
  goTab: (tab) => navigate(`/${tab}`),
  goTo: (route) => navigate(`/${route}`),
  openMatch: (id) => navigate(`/match/${id}`),
  openFavorites: () => navigate("/favorites"),
  openPremium: () => navigate("/premium"),
  openCoins: () => navigate("/coins"),
  openAvatarPicker: () => navigate("/avatar"),
  closeMatch: () => window.history.back(),
  closeSubpage: () => window.history.back(),
  setMatchTab: (matchTab) => store.setState({ matchTab }),
  subscribe: () => {
    store.setState({ isVip: true });
    showToast("Welcome to VIP — every tip is unlocked", "success");
    window.history.back();
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
  toggleFavorite: (matchId) =>
    store.setState((state) => {
      const isFav = state.favoriteMatchIds.includes(matchId);
      showToast(isFav ? "Removed from favourites" : "Added to favourites");
      return {
        favoriteMatchIds: isFav
          ? state.favoriteMatchIds.filter((id) => id !== matchId)
          : [...state.favoriteMatchIds, matchId],
      };
    }),
  selectDay: (offset) => store.setState({ selectedDayOffset: offset }),
  toggleDarkTheme: () => store.setState((state) => ({ darkTheme: !state.darkTheme })),
  toggleNotificationPref: (key) =>
    store.setState((state) => ({ notificationPrefs: { ...state.notificationPrefs, [key]: !state.notificationPrefs[key] } })),
  setLanguage: (lang) => {
    store.setState({ language: lang });
    showToast(`Language set to ${lang}`);
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) showToast("Unable to sign out right now", "error");
    else { store.setState({ authUser: null }); navigate("/"); }
  },
  setAvatar: (avatarId) => {
    store.setState({ avatarId });
    showToast("Avatar updated", "success");
    window.history.back();
  },
};

function App(state) {
  const openMatch = matches.find((m) => m.id === state.openMatchId);

  const isUnlocked = (matchId) => state.isVip || state.unlockedMatchIds.includes(matchId);
  const onBack = actions.closeSubpage;
  const avatarSrc = getAvatarSrc(state.avatarId);

  let content;
  if (state.openFixtureId) {
    content = lazyScreen("MatchScreen", () => import("./components/MatchScreen.js"), { fixtureId: state.openFixtureId, matchTab: state.matchTab, onBack: actions.closeMatch, isFavorite: state.favoriteMatchIds.includes(state.openFixtureId), onToggleFavorite: () => actions.toggleFavorite(state.openFixtureId) });
  } else if (openMatch) {
    content = lazyScreen("MatchScreen", () => import("./components/MatchScreen.js"), {
      match: openMatch,
      matchTab: state.matchTab,
      isVip: isUnlocked(openMatch.id),
      coins: state.coins,
      isFavorite: state.favoriteMatchIds.includes(openMatch.id),
      onBack: actions.closeMatch,
      onTabChange: actions.setMatchTab,
      onRequestUpgrade: actions.openPremium,
      onUnlockWithCoins: () => actions.unlockWithCoins(openMatch.id),
      onToggleFavorite: () => actions.toggleFavorite(openMatch.id),
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
      onOpenVip: () => actions.goTab("vip"),
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
    content = lazyScreen("EditProfileScreen", () => import("./components/EditProfileScreen.js"), { onBack, avatarSrc, onChooseAvatar: actions.openAvatarPicker });
  } else if (state.tab === "avatar") {
    content = lazyScreen("AvatarPickerScreen", () => import("./components/AvatarPickerScreen.js"), { current: state.avatarId, onSelect: actions.setAvatar, onBack });
  } else if (state.tab === "change-password") {
    content = lazyScreen("ChangePasswordScreen", () => import("./components/ChangePasswordScreen.js"), { onBack });
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
      darkTheme: state.darkTheme,
      onToggleDarkTheme: actions.toggleDarkTheme,
      onOpenFavorites: actions.openFavorites,
      onRequestUpgrade: actions.openPremium,
      onOpenCoins: actions.openCoins,
      currentLanguage: state.language,
      onNavigate: actions.goTo,
      avatarSrc,
      authUser: state.authUser,
      onOpenAuth: () => actions.goTo("auth"),
      onSignOut: actions.signOut,
    });
  }

  const navActive = PROFILE_SUBPAGES.includes(state.tab) ? "profile" : state.tab;

  return h("div", { className: "app-shell" }, [
    content,
    state.tab === "auth" ? null : BottomNav({ active: navActive, onChange: actions.goTab }),
  ]);
}

let lastRenderError = null;

function render() {
  const root = document.getElementById("root");
  if (!root) return;
  const state = store.getState();
  document.body.classList.toggle("theme-dark", state.darkTheme);
  try {
    root.innerHTML = "";
    root.appendChild(App(state));
    lastRenderError = null;
  } catch (error) {
    console.error("Scoutwave render error:", error);
    if (lastRenderError === error) return;
    lastRenderError = error;
    root.innerHTML = "";
    root.appendChild(h("main", { className: "screen app-error-screen" }, [
      h("div", { className: "app-error-card card" }, [
        h("div", { className: "app-error-icon" }, [h("i", { "data-lucide": "triangle-alert" })]),
        h("h1", {}, "Something went wrong"),
        h("p", {}, "This screen could not be displayed. Your saved favourites and account data are still safe."),
        h("button", { className: "primary-button", onClick: () => window.location.reload() }, "Reload app")
      ])
    ]));
  }
}

store.subscribe(render);

supabase.auth.getUser()
  .then(({ data }) => store.setState({ authUser: data?.user || null }))
  .catch(() => {});

supabase.auth.onAuthStateChange((_event, session) => {
  store.setState({ authUser: session?.user || null });
});

initRouter();
