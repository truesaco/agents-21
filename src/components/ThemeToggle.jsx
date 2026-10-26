import { useEffect, useRef, useState } from "react";
import { THEME_CHOICES, applyTheme, readThemeChoice, saveThemeChoice, watchSystemTheme } from "./theme.js";

// Light / Dark / System switch in the header. ARIA radio group with a roving
// tab stop: Tab reaches the checked option, arrow keys (and Home/End) move and
// select, Enter/Space select the focused option.
const LABELS = { light: "Light", dark: "Dark", system: "System" };

const ICONS = {
  light: (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06" />
    </>
  ),
  dark: <path d="M13.5 9.6A5.5 5.5 0 0 1 6.4 2.5a5.5 5.5 0 1 0 7.1 7.1Z" />,
  system: (
    <>
      <rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1.5" />
      <path d="M5.5 14h5M8 11.25V14" />
    </>
  ),
};

export default function ThemeToggle() {
  const [choice, setChoice] = useState(readThemeChoice);
  const refs = useRef({});

  useEffect(() => {
    applyTheme(choice);
    if (choice !== "system") return undefined;
    return watchSystemTheme(() => applyTheme("system"));
  }, [choice]);

  const select = (next, focus = false) => {
    setChoice(next);
    saveThemeChoice(next);
    if (focus) refs.current[next]?.focus();
  };

  const onKeyDown = (e) => {
    const i = THEME_CHOICES.indexOf(choice);
    const n = THEME_CHOICES.length;
    const moves = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    select(THEME_CHOICES[(moves[e.key] + n) % n], true);
  };

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Color theme" onKeyDown={onKeyDown}>
      {THEME_CHOICES.map((c) => (
        <button
          key={c}
          ref={(el) => (refs.current[c] = el)}
          type="button"
          role="radio"
          aria-checked={choice === c}
          aria-label={LABELS[c]}
          title={`${LABELS[c]} theme`}
          tabIndex={choice === c ? 0 : -1}
          className="theme-option"
          onClick={() => select(c)}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
            {ICONS[c]}
          </svg>
        </button>
      ))}
    </div>
  );
}
