export const matches = [
  {
    id: 1,
    league: "Premier League",
    home: "Everton",
    away: "Man United",
    scoreH: "1",
    scoreA: "1",
    time: "63'",
    status: "live",
    minute: 63,
    h2h: "Man United won 3 of last 5 meetings",
    form: { home: ["W", "D", "L", "W", "W"], away: ["L", "W", "W", "D", "W"] },
    odds: [
      { book: "Bet365", h: 3.5, d: 3.6, a: 2.05 },
      { book: "Pinnacle", h: 3.4, d: 3.55, a: 2.1 },
      { book: "1xBet", h: 3.55, d: 3.5, a: 2.02 },
    ],
    winner: "Man United",
    confidence: 74,
    votes: { h: 32, d: 21, a: 47 },
    lineup: {
      formation: { home: "4-3-3", away: "4-2-3-1" },
      home: [
        { no: 1, name: "Pickford", pos: "GK" }, { no: 2, name: "Coleman", pos: "RB" }, { no: 5, name: "Tarkowski", pos: "CB" },
        { no: 6, name: "Branthwaite", pos: "CB" }, { no: 3, name: "Mykolenko", pos: "LB" }, { no: 8, name: "Onana", pos: "CM" },
        { no: 4, name: "Gueye", pos: "CM" }, { no: 10, name: "Doucoure", pos: "CM" }, { no: 7, name: "Harrison", pos: "RW" },
        { no: 9, name: "Beto", pos: "ST" }, { no: 11, name: "McNeil", pos: "LW" },
      ],
      away: [
        { no: 1, name: "Onana", pos: "GK" }, { no: 24, name: "Mainoo", pos: "CDM" }, { no: 6, name: "Maguire", pos: "CB" },
        { no: 19, name: "Yoro", pos: "CB" }, { no: 23, name: "Malacia", pos: "LB" }, { no: 18, name: "Casemiro", pos: "CDM" },
        { no: 8, name: "Bruno F.", pos: "AM" }, { no: 7, name: "Mount", pos: "AM" }, { no: 21, name: "Antony", pos: "RW" },
        { no: 9, name: "Hojlund", pos: "ST" }, { no: 11, name: "Zirkzee", pos: "LW" },
      ],
    },
    standings: {
      leagueName: "Premier League",
      rows: [
        { pos: 9, team: "Man United", played: 5, points: 8 },
        { pos: 10, team: "Everton", played: 5, points: 7 },
        { pos: 11, team: "Fulham", played: 5, points: 6 },
      ],
      highlight: ["Man United", "Everton"],
    },
  },
  {
    id: 2,
    league: "La Liga",
    home: "Real Madrid",
    away: "Sevilla",
    scoreH: "—",
    scoreA: "—",
    time: "16:15",
    status: "upcoming",
    h2h: "Real Madrid unbeaten in last 6 meetings",
    form: { home: ["W", "W", "W", "D", "W"], away: ["L", "D", "L", "W", "L"] },
    odds: [
      { book: "Bet365", h: 1.3, d: 5.2, a: 9.5 },
      { book: "Pinnacle", h: 1.28, d: 5.4, a: 10.0 },
      { book: "1xBet", h: 1.32, d: 5.1, a: 9.2 },
    ],
    winner: "Real Madrid",
    confidence: 88,
    votes: { h: 81, d: 12, a: 7 },
    lineup: {
      formation: { home: "4-3-3", away: "4-4-2" },
      home: [
        { no: 1, name: "Courtois", pos: "GK" }, { no: 2, name: "Carvajal", pos: "RB" }, { no: 4, name: "Alaba", pos: "CB" },
        { no: 22, name: "Rudiger", pos: "CB" }, { no: 23, name: "Mendy", pos: "LB" }, { no: 12, name: "Camavinga", pos: "CM" },
        { no: 5, name: "Bellingham", pos: "CM" }, { no: 15, name: "Valverde", pos: "CM" }, { no: 7, name: "Vinicius Jr", pos: "LW" },
        { no: 9, name: "Mbappe", pos: "ST" }, { no: 11, name: "Rodrygo", pos: "RW" },
      ],
      away: [
        { no: 1, name: "Nyland", pos: "GK" }, { no: 2, name: "Carmona", pos: "RB" }, { no: 15, name: "Nianzou", pos: "CB" },
        { no: 3, name: "Badé", pos: "CB" }, { no: 23, name: "Vidal", pos: "LB" }, { no: 6, name: "Gudelj", pos: "CM" },
        { no: 8, name: "Suso", pos: "CM" }, { no: 21, name: "Lukebakio", pos: "RM" }, { no: 11, name: "Rakitic", pos: "LM" },
        { no: 9, name: "En-Nesyri", pos: "ST" }, { no: 19, name: "Lukebakio", pos: "ST" },
      ],
    },
    standings: {
      leagueName: "La Liga",
      rows: [
        { pos: 1, team: "Real Madrid", played: 5, points: 15 },
        { pos: 2, team: "Barcelona", played: 5, points: 13 },
        { pos: 14, team: "Sevilla", played: 5, points: 5 },
      ],
      highlight: ["Real Madrid", "Sevilla"],
    },
  },
  {
    id: 3,
    league: "Serie A",
    home: "Inter",
    away: "Napoli",
    scoreH: "1",
    scoreA: "1",
    time: "FT",
    status: "finished",
    h2h: "Last 3 meetings all drawn",
    form: { home: ["W", "D", "W", "L", "D"], away: ["W", "W", "D", "W", "L"] },
    odds: [
      { book: "Bet365", h: 2.2, d: 3.2, a: 3.3 },
      { book: "Pinnacle", h: 2.25, d: 3.1, a: 3.35 },
      { book: "1xBet", h: 2.18, d: 3.25, a: 3.28 },
    ],
    winner: "Draw",
    confidence: 52,
    votes: { h: 38, d: 29, a: 33 },
    lineup: {
      formation: { home: "3-5-2", away: "4-3-3" },
      home: [
        { no: 1, name: "Sommer", pos: "GK" }, { no: 95, name: "Bastoni", pos: "CB" }, { no: 6, name: "de Vrij", pos: "CB" },
        { no: 15, name: "Acerbi", pos: "CB" }, { no: 2, name: "Dumfries", pos: "RWB" }, { no: 20, name: "Calhanoglu", pos: "CM" },
        { no: 5, name: "Barella", pos: "CM" }, { no: 21, name: "Frattesi", pos: "CM" }, { no: 8, name: "Dimarco", pos: "LWB" },
        { no: 9, name: "Thuram", pos: "ST" }, { no: 10, name: "Lautaro", pos: "ST" },
      ],
      away: [
        { no: 1, name: "Meret", pos: "GK" }, { no: 22, name: "Di Lorenzo", pos: "RB" }, { no: 5, name: "Rrahmani", pos: "CB" },
        { no: 26, name: "Buongiorno", pos: "CB" }, { no: 17, name: "Olivera", pos: "LB" }, { no: 20, name: "Lobotka", pos: "CM" },
        { no: 68, name: "Anguissa", pos: "CM" }, { no: 7, name: "Politano", pos: "RW" }, { no: 99, name: "Raspadori", pos: "AM" },
        { no: 81, name: "Osimhen", pos: "ST" }, { no: 11, name: "Kvaratskhelia", pos: "LW" },
      ],
    },
    standings: {
      leagueName: "Serie A",
      rows: [
        { pos: 2, team: "Inter", played: 5, points: 12 },
        { pos: 3, team: "Napoli", played: 5, points: 11 },
        { pos: 1, team: "Juventus", played: 5, points: 13 },
      ],
      highlight: ["Inter", "Napoli"],
    },
  },
];

export const newsArticles = [
  {
    id: 1,
    title: "Man United winless run extends to four games",
    source: "Scoutwave Desk",
    time: "2h ago",
    category: "Premier League",
    featured: true,
    snippet: "Injuries in midfield continue to disrupt the away side's shape ahead of Sunday's trip to Goodison Park.",
    gradient: ["#E8442A", "#7A1F12"],
  },
  {
    id: 2,
    title: "Real Madrid confirm Bellingham fit for Sevilla clash",
    source: "Scoutwave Desk",
    time: "5h ago",
    category: "La Liga",
    featured: false,
    snippet: "The midfielder returns from a minor knock and is expected to start at the Bernabéu.",
    gradient: ["#2A4E8C", "#122349"],
  },
  {
    id: 3,
    title: "Serie A: Inter and Napoli meet in top-of-table clash",
    source: "Scoutwave Desk",
    time: "1d ago",
    category: "Serie A",
    featured: false,
    snippet: "Both sides unbeaten in five, with the draw the most backed outcome across bookmakers this week.",
    gradient: ["#2E8C4E", "#123A21"],
  },
];

export const faqItems = [
  { q: "Where do match data and predictions come from?", a: "Fixtures, scores, statistics, odds and predictions are provided by API-Football. Scoutwave does not yet publish its own tracked results." },
  { q: "What's the difference between VIP and coins?", a: "VIP unlocks every locked tip for the length of your subscription. Coins unlock one specific tip's result without subscribing." },
  { q: "Can I get a refund on a coin unlock?", a: "Coin unlocks are final once the locked content is revealed, the same way a paid preview works elsewhere." },
  { q: "Why is a match missing odds from a bookmaker?", a: "We only show a bookmaker once they've published a firm price for that market — some markets open later than others." },
];

export const languages = ["English", "Español", "Français", "Português", "Deutsch", "Italiano"];

