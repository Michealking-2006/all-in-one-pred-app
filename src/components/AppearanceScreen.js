import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { clubById } from "../clubs.js";
import { ClubTiles } from "./ClubPicker.js";

const OPTIONS = [
  { id: "system", icon: "smartphone", title: "System", subtitle: "Matches your device setting" },
  { id: "light", icon: "sun", title: "Light", subtitle: "Always use the light theme" },
  { id: "dark", icon: "moon", title: "Dark", subtitle: "Always use the dark theme" },
];

const PERF_OPTIONS = [
  { id: "auto", icon: "smartphone", title: "Automatic", subtitle: "Lighter mode on low-memory phones and data saver" },
  { id: "on", icon: "zap", title: "Lighter mode", subtitle: "Smoothest on older phones, uses less battery" },
  { id: "off", icon: "sparkles", title: "Full effects", subtitle: "Blur, animations and all theme effects" },
];

export function AppearanceScreen({ current, club, perfMode = "auto", onPerfMode = () => {}, fxActive = "", onSelect, onSelectClub, onBack }) {
  const activeId = club?.id || null;
  const active = clubById(activeId);

  const clubSection = [
    text("div", { className: "profile-section-label" }, "Your club"),
    fxActive ? text("p", { className: "screen-note club-paused" }, "The " + fxActive + " theme is active, so club colours are paused. They come back when you switch it off in Advanced themes.") : null,
    h("div", { className: "club-grid-wrap" }, [ClubTiles({ selectedId: activeId, onSelect: onSelectClub })]),
    h("section", { className: "selection-list card" }, [
      h("button", { type: "button", className: "selection-row appearance-row", onClick: () => onSelectClub(null) }, [
        h("i", { "data-lucide": "circle-dashed" }),
        h("span", { className: "appearance-copy" }, [text("span", {}, "No club"), text("small", {}, "Scoutwave's standard red")]),
        !activeId ? h("i", { "data-lucide": "check" }) : null,
      ]),
    ]),
    text("p", { className: "screen-note" }, active ? active.motto + ". The whole app wears " + active.name + " colours and crest." : "Pick the club you support and the whole app wears its colours and crest."),
  ];

  return h("main", { className: "screen language-screen" }, [
    PageHeader({ title: "Appearance", onBack }),
    ...clubSection,
    text("div", { className: "profile-section-label" }, "Mode"),
    h("section", { className: "selection-list card" }, OPTIONS.map((opt) =>
      h("button", { type: "button", className: "selection-row appearance-row", onClick: () => onSelect(opt.id) }, [
        h("i", { "data-lucide": opt.icon }),
        h("span", { className: "appearance-copy" }, [text("span", {}, opt.title), text("small", {}, opt.subtitle)]),
        opt.id === current ? h("i", { "data-lucide": "check" }) : null,
      ])
    )),
    text("p", { className: "screen-note" }, "System follows your phone's Light/Dark setting and switches automatically."),

    text("div", { className: "profile-section-label" }, "Performance"),
    h("section", { className: "selection-list card" }, PERF_OPTIONS.map((opt) =>
      h("button", { type: "button", className: "selection-row appearance-row", onClick: () => onPerfMode(opt.id) }, [
        h("i", { "data-lucide": opt.icon }),
        h("span", { className: "appearance-copy" }, [text("span", {}, opt.title), text("small", {}, opt.subtitle)]),
        opt.id === perfMode ? h("i", { "data-lucide": "check" }) : null,
      ])
    )),
    text("p", { className: "screen-note" }, "Lighter mode removes blur and animated theme effects, keeps smaller caches and refreshes less often. It is what phones with 2 GB of memory or less need to stay smooth."),
  ]);
}
