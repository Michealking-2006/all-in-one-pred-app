import { h, text } from "../utils/h.js";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// props: { selectedOffset, onSelectDay } — offset is days from today (-3..3)
export function DateStrip({ selectedOffset, onSelectDay }) {
  const today = new Date();
  const days = [-3, -2, -1, 0, 1, 2, 3].map((offset) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    return { offset, label: offset === 0 ? "Today" : DAY_LABELS[d.getDay()], date: d.getDate() };
  });

  return h(
    "div",
    { style: { display: "flex", justifyContent: "space-between", padding: "14px 14px 18px" } },
    days.map(({ offset, label, date }) => {
      const isSelected = offset === selectedOffset;
      return h(
        "button",
        {
          onClick: () => onSelectDay(offset),
          style: {
            border: "none",
            background: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            padding: "0",
            color: "var(--on-accent)",
          },
        },
        [
          text("span", { style: { fontSize: "12px", fontWeight: isSelected ? "700" : "500", opacity: isSelected ? "1" : "0.85" } }, label),
          h(
            "span",
            {
              className: "mono",
              style: {
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "700",
                background: isSelected ? "var(--on-accent)" : "rgba(255,255,255,0.18)",
                color: isSelected ? "var(--accent)" : "var(--on-accent)",
              },
            },
            String(date)
          ),
        ]
      );
    })
  );
}
