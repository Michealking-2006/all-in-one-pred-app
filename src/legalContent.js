// Copy for the About, Privacy policy and Terms of use screens. Kept as plain data so each screen stays small and
// tests/legal.test.mjs can check the length. A section is { h: heading, p: [paragraphs], ul: [bullet points] }.
import { h, text } from "./utils/h.js";
import { SUPPORT_EMAIL } from "./config.js";

export const LEGAL_UPDATED = "27 October 2026";

export function renderSections(sections) {
  return sections.flatMap((s) => [
    text("h2", {}, s.h),
    ...(s.p || []).map((para) => text("p", {}, para)),
    ...(s.ul ? [h("ul", {}, s.ul.map((item) => text("li", {}, item)))] : []),
  ]);
}

export const ABOUT_SECTIONS = [
  { h: "Why Scoutwave exists", p: [
    "Football is spread over too many apps. Scores are in one, stats in another, news in a third, and tipsters rarely show how often they get it wrong. Scoutwave puts live scores, stats, news and our own predictions in one app, and shows how the predictions actually turn out.",
    "It is made for people who follow the game closely: the score, the lineup, the table, recent form and a prediction for what happens next.",
  ] },
  { h: "What you can do in Scoutwave", ul: [
    "Follow livescores and fixtures across the major leagues and cups, with a day-by-day view of what is on.",
    "Open a match to see lineups, events, statistics, head-to-head history and a bookmaker odds comparison.",
    "Browse league tables, clubs, players and stadiums, and star the ones you care about as favourites.",
    "Read football news from many publishers in one feed, with links back to the original source.",
    "See our predictions for each match, with a record of how past ones turned out.",
    "Turn on notifications for kick-offs, goals and final whistles for the matches and clubs you follow.",
    "Switch between light and dark, or pick your club's colours or an animated theme.",
  ] },
  { h: "How our predictions work", p: [
    "Scoutwave predictions come from our own statistical model, not from a third-party tipster. The model starts with league tables, using the goals each team scores and concedes at home and away to estimate the strength of its attack and defence. When a team has played only a few games, those estimates are blended toward the league average so a small sample cannot mislead.",
    "Recent form can move the expected goals a little, but only by a small, capped amount. A Poisson scoreline model then turns expected goals into probabilities for a home win, draw or away win, for over or under 2.5 goals, for both teams to score, and for the most likely score.",
    "A probability is not a promise. A 60 percent chance means the other outcomes still happen four times in ten. We label our confidence honestly, and we mark a prediction as low confidence when there is little data or the match is close to a coin flip.",
  ] },
  { h: "Honest accuracy", p: [
    "Every prediction is recorded before kick-off and is never changed afterwards, so there is no hindsight. When the match finishes it is graded on the 90-minute result, and the app shows tracked accuracy by market. We only publish an accuracy figure once enough matches have been graded for it to mean something. If the model has a bad month, you will see that too.",
  ] },
  { h: "Where our data comes from", p: [
    "Fixtures, live scores, lineups, statistics and standings come from a professional football data provider. News headlines come from a news data service and always link to the publisher that wrote them. To keep the app fast and respectful of your data allowance, we cache information for short periods, so a number on screen can occasionally lag behind the stadium. For anything that matters, such as a ticket or a bet placed elsewhere, check an official source.",
  ] },
  { h: "Premium and coins", p: [
    "The core of Scoutwave is free. Premium unlocks every prediction in full, the complete odds comparison, tracked accuracy by market, an exclusive animated theme and a verified badge on your profile. Premium is bought for a fixed period as a one-time payment. It never renews on its own, so there is nothing to cancel.",
    "Coins are a lighter option. You can spend them to unlock the tip for a single match or to unlock a theme. Payments are handled by our payment provider, Polar, on its own secure checkout page.",
  ] },
  { h: "What we stand for", ul: [
    "Few numbers, clearly shown.",
    "We show how sure the model is and publish its record.",
    "No advertising trackers, and we don't sell personal data.",
    "Light enough for ordinary phones and slow connections.",
    "Scoutwave is not a bookmaker, takes no bets, and is not affiliated with or endorsed by any club, league or competition. Club names and crests belong to their owners.",
  ] },
  { h: "Get in touch", p: [
    "Questions, bugs, ideas or a score that looks wrong? Write to " + SUPPORT_EMAIL + ", or use Contact us, Report an issue and Feedback from the Profile tab. We read every message.",
  ] },
];

export const PRIVACY_SECTIONS = [
  { h: "1. Who we are", p: [
    "Scoutwave (\"we\", \"us\") provides the Scoutwave football app and website. This policy explains what personal data we collect, why, who we share it with, how long we keep it and what choices you have. If you have a question about it, write to " + SUPPORT_EMAIL + ".",
  ] },
  { h: "2. What we collect", p: ["What we collect depends on how you use the app. You can use much of Scoutwave without an account."], ul: [
    "Account details: your email address and password when you sign up. Passwords are handled by our authentication provider and are not readable by us. If you continue with Google, we receive your email address and name from Google. You may also add a display name and choose an avatar.",
    "Purchases: your Premium status and end date, your coin balance, the themes and tips you have unlocked, a ledger of coin movements, and a record of each paid order (order number, product and whether it was refunded). We never see your card number.",
    "Notification settings: if you turn on alerts, the address your browser or device gives us for push messages, your alert preferences, and the matches and clubs you starred.",
    "Messages you send us: the text, your email address, optional name and rating, and some technical context such as the app version, the page you were on and your browser type.",
    "Technical data: like any website, our servers and hosting provider process your IP address and request details to deliver the app, prevent abuse and keep it secure.",
  ] },
  { h: "3. What stays on your device", p: [
    "Scoutwave saves settings in your browser's local storage so the app remembers you: your favourites, language, theme and appearance choices, avatar, notification preferences, performance mode and, when you are not signed in, your demo coin balance and unlocks. When you sign in, your session is also kept there. We do not use advertising or cross-site tracking cookies. You can clear this storage at any time from your browser settings, and you will be signed out and your local settings reset.",
  ] },
  { h: "4. How we use your data", ul: [
    "To run the app: sign you in, keep your settings, load scores and show your favourites.",
    "To deliver what you buy: add Premium time or coins to your account and take them back if an order is refunded.",
    "To send the notifications you asked for, and nothing else.",
    "To answer your messages and fix problems you report.",
    "To keep the service safe: limit abuse, detect fraud and investigate security problems.",
    "To improve Scoutwave using totals only, such as how often the app loads data from its cache or how many times a sponsored space was seen. These counts contain no names, accounts, devices or addresses.",
  ], p: ["We do not sell your personal data, and we do not use it to build advertising profiles."] },
  { h: "5. Who we share it with", p: [
    "We use a small number of service providers who process data on our behalf, only to provide their service to us:",
  ], ul: [
    "Supabase, for our database and sign-in.",
    "Vercel, for hosting and delivering the app.",
    "Polar, for checkout and payment. Polar collects your payment and billing details directly under its own privacy policy.",
    "Formspree, which emails us the support and feedback messages you submit.",
    "Your browser's push service (operated by Google, Mozilla, Apple or Microsoft), which delivers notifications to your device.",
    "Google Fonts, which supplies the typeface. Your browser contacts Google to download it, which reveals your IP address to Google. The font is skipped on slow connections and in data saver mode.",
    "Football and news data providers. We request match and news data from our servers, so these providers do not receive your personal details.",
  ], },
  { h: "6. Payments", p: [
    "When you buy Premium or coins you are sent to Polar's hosted checkout page. We pass along your email address and an internal account reference so we can match the payment to your account. Polar tells us when an order is paid or refunded, and we record the order number, the product and the result. We decide what each product is worth on our own server, so nothing sent from your browser can change a price or a reward.",
  ] },
  { h: "7. How long we keep it", p: [
    "We keep account and purchase data while your account exists. If your account is deleted, the entitlements, coin ledger, order records and notification subscriptions linked to it are deleted too, apart from limited records we are required to keep for accounting, tax or legal reasons. Support messages are kept for as long as needed to handle your request and to understand recurring problems. Push subscriptions that stop working are removed automatically. Aggregated counts that contain no personal data may be kept indefinitely.",
  ] },
  { h: "8. Security", p: [
    "Data travels over encrypted connections. Account and purchase tables are not readable from the browser at all, and only our servers can change them. Webhooks from our payment provider are verified with a cryptographic signature before anything is granted. No system is perfectly secure, so please use a strong, unique password and tell us straight away if you suspect your account has been misused.",
  ] },
  { h: "9. Your choices and rights", p: [
    "Depending on where you live, you may have the right to access the personal data we hold about you, correct it, delete it, restrict or object to some uses, receive a copy in a portable format, and withdraw consent you gave earlier. You can also complain to your local data protection authority. To use any of these rights, email " + SUPPORT_EMAIL + " from the address on your account. We may need to confirm it is really you before we act.",
    "You can switch notifications off at any time in the app or in your browser settings, and you can sign out whenever you like. Our sponsored-space counters switch themselves off if your browser sends a Do Not Track or Global Privacy Control signal.",
  ] },
  { h: "10. Children", p: [
    "Scoutwave is not directed at children under 13, and we do not knowingly collect their personal data. If you believe a child has given us personal data, contact us and we will delete it.",
  ] },
  { h: "11. International transfers", p: [
    "Our providers may process data in countries other than your own. Where that happens, we rely on the safeguards those providers offer, such as standard contractual clauses, to protect it.",
  ] },
  { h: "12. Changes to this policy", p: [
    "If we change how we handle personal data we will update this page and its date, and for significant changes we will tell you in the app. This policy was last updated on " + LEGAL_UPDATED + ".",
  ] },
];

export const TERMS_SECTIONS = [
  { h: "1. Agreeing to these terms", p: [
    "These terms govern your use of the Scoutwave app and website. By using Scoutwave, creating an account or buying anything, you agree to them and to our Privacy policy. If you do not agree, please do not use the service.",
  ] },
  { h: "2. Who may use Scoutwave", p: [
    "You must be at least 13 years old and old enough under the law where you live to enter into a contract, or have a parent or guardian's permission. You can browse Scoutwave as a guest. Some features, including purchases, synced Premium and coins, and server-side tips, need an account.",
  ] },
  { h: "3. Your account", p: [
    "Give accurate details and keep your password private. You are responsible for what happens under your account, so tell us promptly if you think it has been used without your permission. One person should use one account, and accounts may not be sold or transferred.",
  ] },
  { h: "4. Predictions and football data are information only", p: [
    "Predictions, probabilities, statistics, odds and other content in Scoutwave are provided for information and entertainment. They are estimates produced by a statistical model and third-party data, not guarantees, and they are not betting, financial or professional advice. Past accuracy does not promise future results, and data can be delayed, incomplete or wrong.",
    "Scoutwave is not a bookmaker and does not accept bets. Odds are shown only for comparison. Gambling is regulated differently around the world, and you are responsible for following the law where you live. If gambling is causing you or someone you know harm, please contact a local support service.",
  ] },
  { h: "5. Premium", p: [
    "Premium is a one-time purchase for a fixed period, such as one month or twelve months. It does not renew automatically. Buying it again adds time to the end of your current Premium. Premium that we grant to you without an end date stays without an end date. Premium unlocks the features described in the app at the time you buy it, and we may improve or reorganise those features over time.",
  ] },
  { h: "6. Coins", p: [
    "Coins are virtual items used inside Scoutwave to unlock individual tips and themes. They have no cash value, cannot be transferred or exchanged for money, and are not a form of currency or deposit. We may change the coin price of tips and themes, and we may correct a balance if there was an error. Unlocked items stay unlocked on your account.",
  ] },
  { h: "7. Payments and refunds", p: [
    "Payments are processed by Polar on its checkout page, and the price you see there is the price you pay. Premium or coins are added to your account once the payment is confirmed, which usually takes a few seconds but can take longer.",
    "If something goes wrong, or you think you were charged by mistake, email " + SUPPORT_EMAIL + " with your order details. When an order is refunded, the Premium time or coins it provided are removed from your account. If you have already spent refunded coins, we may reduce your balance as far as it allows. Nothing in these terms limits any refund or cancellation rights you have under the law where you live.",
  ] },
  { h: "8. Acceptable use", p: ["When using Scoutwave, you agree not to:"], ul: [
    "break the law or infringe anyone else's rights;",
    "scrape, copy or resell our data, predictions or content in bulk, or use them to build a competing service;",
    "attempt to bypass Premium, coins, rate limits or any other access control, or tamper with prices or purchases;",
    "probe, disrupt or overload our systems, or try to access accounts or data that are not yours;",
    "upload malicious code, or send abusive, misleading or spam messages through our forms.",
  ] },
  { h: "9. Notifications", p: [
    "If you turn on push notifications, you agree to receive the alerts you selected. Alerts depend on third-party data and push services, so they can be late or missed. Do not rely on them for anything time-critical. You can turn them off at any time.",
  ] },
  { h: "10. Our content and third-party content", p: [
    "The Scoutwave app, design, wordmark, prediction model and written content belong to us or our licensors. We give you a personal, non-commercial, revocable licence to use the app. You may share the images the app creates for you, such as match cards, for personal use. Club names, crests, player photos and competition marks belong to their owners and appear only to identify them. News headlines belong to their publishers and link to the original article.",
  ] },
  { h: "11. Feedback you send us", p: [
    "If you send ideas or feedback, you let us use them freely to improve Scoutwave, without payment or credit. Please do not include sensitive information in your messages.",
  ] },
  { h: "12. Availability and changes", p: [
    "We work hard to keep Scoutwave running, but we provide it as it is and as it is available. We may change, pause or remove features, for example because a data provider changes, and the service may be interrupted for maintenance or reasons outside our control.",
  ] },
  { h: "13. Limits of liability", p: [
    "To the fullest extent the law allows, Scoutwave is not liable for indirect or consequential losses, lost profits or lost data, or for decisions you make based on predictions, odds or statistics. Our total liability to you for any claim relating to the service is limited to the amount you paid us in the twelve months before the claim, or zero if you paid nothing. Nothing in these terms excludes liability that cannot be excluded by law, including for death or personal injury caused by negligence, fraud, or your statutory consumer rights.",
  ] },
  { h: "14. Suspension and ending", p: [
    "You can stop using Scoutwave at any time and can ask us to delete your account. We may suspend or close an account that breaks these terms, puts the service or other people at risk, or is involved in fraud or chargeback abuse. When we do, we will explain why unless the law prevents it. Sections that by their nature should continue, such as those on liability and intellectual property, continue afterwards.",
  ] },
  { h: "15. Changes to these terms", p: [
    "We may update these terms as the service evolves. When we make a material change we will update the date below and tell you in the app. If you keep using Scoutwave after a change takes effect, you accept the new terms. These terms were last updated on " + LEGAL_UPDATED + ".",
  ] },
  { h: "16. Governing law and contact", p: [
    "These terms are governed by the law of the country where the Scoutwave operator is established, without taking away the mandatory consumer protections of the country where you live. Questions about these terms can be sent to " + SUPPORT_EMAIL + ".",
  ] },
];
