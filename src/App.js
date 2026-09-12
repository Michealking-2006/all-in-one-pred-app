import { h } from "./utils/h.js";
import { store, UNLOCK_COST } from "./store.js";
import { navigate, initRouter } from "./router.js";
import { showToast } from "./toast.js";
import { matches } from "./data/mockData.js";
import { getAvatarSrc } from "./data/avatars.js";
import { BottomNav } from "./components/BottomNav.js";
import { HomeScreen } from "./components/HomeScreen.js";
import { LeaguesScreen } from "./components/LeaguesScreen.js";
import { MatchScreen } from "./components/MatchScreen.js";
import { VipTipsScreen } from "./components/VipTipsScreen.js";
import { ProfileScreen } from "./components/ProfileScreen.js";
import { FavoritesScreen } from "./components/FavoritesScreen.js";
import { EditProfileScreen } from "./components/EditProfileScreen.js";
import { ChangePasswordScreen } from "./components/ChangePasswordScreen.js";
import { NewsScreen } from "./components/NewsScreen.js";
import { NotificationsScreen } from "./components/NotificationsScreen.js";
import { HelpCentreScreen } from "./components/HelpCentreScreen.js";
import { ReportIssueScreen } from "./components/ReportIssueScreen.js";
import { ContactUsScreen } from "./components/ContactUsScreen.js";
import { PrivacyPolicyScreen } from "./components/PrivacyPolicyScreen.js";
import { TermsOfUseScreen } from "./components/TermsOfUseScreen.js";
import { AboutScreen } from "./components/AboutScreen.js";
import { LanguageScreen } from "./components/LanguageScreen.js";
import { PremiumScreen } from "./components/PremiumScreen.js";
import { CoinsScreen } from "./components/CoinsScreen.js";
import { AvatarPickerScreen } from "./components/AvatarPickerScreen.js";
import { LeaguePage } from "./components/LeaguePage.js";
import { ClubPage } from "./components/ClubPage.js";
import { VenuePage } from "./components/VenuePage.js";
import { PlayerPage } from "./components/PlayerPage.js";
import { SearchScreen } from "./components/SearchScreen.js";

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
  if (openMatch) {
    content = MatchScreen({
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
    const { type, id } = state.openEntity;
    if (type === "league") content = LeaguePage({ id, onBack: actions.closeSubpage });
    else if (type === "club") content = ClubPage({ id, onBack: actions.closeSubpage });
    else if (type === "venue") content = VenuePage({ id, onBack: actions.closeSubpage });
    else if (type === "player") content = PlayerPage({ id, onBack: actions.closeSubpage });
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
    content = LeaguesScreen();
  } else if (state.tab === "search") {
    content = SearchScreen({ onBack: actions.closeSubpage });
  } else if (state.tab === "vip") {
    content = VipTipsScreen({ isVip: state.isVip, isUnlocked });
  } else if (state.tab === "favorites") {
    content = FavoritesScreen({ favoriteMatchIds: state.favoriteMatchIds, onToggleFavorite: actions.toggleFavorite, onOpenMatch: actions.openMatch, onBack });
  } else if (state.tab === "edit-profile") {
    content = EditProfileScreen({ onBack, avatarSrc, onChooseAvatar: actions.openAvatarPicker });
  } else if (state.tab === "avatar") {
    content = AvatarPickerScreen({ current: state.avatarId, onSelect: actions.setAvatar, onBack });
  } else if (state.tab === "change-password") {
    content = ChangePasswordScreen({ onBack });
  } else if (state.tab === "news") {
    content = NewsScreen({ onBack });
  } else if (state.tab === "notifications") {
    content = NotificationsScreen({ prefs: state.notificationPrefs, onTogglePref: actions.toggleNotificationPref, onBack });
  } else if (state.tab === "help-centre") {
    content = HelpCentreScreen({ onBack });
  } else if (state.tab === "report-issue") {
    content = ReportIssueScreen({ onBack });
  } else if (state.tab === "contact-us") {
    content = ContactUsScreen({ onBack });
  } else if (state.tab === "privacy-policy") {
    content = PrivacyPolicyScreen({ onBack });
  } else if (state.tab === "terms-of-use") {
    content = TermsOfUseScreen({ onBack });
  } else if (state.tab === "about") {
    content = AboutScreen({ onBack });
  } else if (state.tab === "language") {
    content = LanguageScreen({ current: state.language, onSelect: actions.setLanguage, onBack });
  } else if (state.tab === "premium") {
    content = PremiumScreen({ isVip: state.isVip, onSubscribe: actions.subscribe, onBack });
  } else if (state.tab === "coins") {
    content = CoinsScreen({ coins: state.coins, onBuy: actions.buyCoins, onBack });
  } else {
    content = ProfileScreen({
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
    });
  }

  const navActive = PROFILE_SUBPAGES.includes(state.tab) ? "profile" : state.tab;

  return h("div", { className: "app-shell" }, [
    content,
    BottomNav({ active: navActive, onChange: actions.goTab }),
  ]);
}

function render() {
  const state = store.getState();
  document.body.classList.toggle("theme-dark", state.darkTheme);
  const root = document.getElementById("root");
  root.innerHTML = "";
  root.appendChild(App(state));
}

store.subscribe(render);
initRouter();
