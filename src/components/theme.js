// Theme preference: "light", "dark" or "system" (default, follows
// prefers-color-scheme). The resolved theme is written to <html data-theme>,
// which switches the CSS tokens in styles.css. Only the preference word is
// stored, and every storage access is wrapped so the app still works when
// localStorage is unavailable (private mode, blocked storage, etc.).
export const THEME_CHOICES = ["light", "dark", "system"];
const STORAGE_KEY = "vendorlens.theme";

const darkQuery = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export function readThemeChoice() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return THEME_CHOICES.includes(value) ? value : "system";
  } catch {
    return "system";
  }
}

export function saveThemeChoice(choice) {
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Storage unavailable: the choice still applies for this visit.
  }
}

export function resolveTheme(choice) {
  if (choice === "light" || choice === "dark") return choice;
  return darkQuery()?.matches ? "dark" : "light";
}

export function applyTheme(choice) {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(choice);
  root.dataset.themeChoice = choice;
}

// Called from main.jsx before React renders, so the first paint of the app
// already uses the right palette (no inline script needed under the CSP).
export function initTheme() {
  const choice = readThemeChoice();
  applyTheme(choice);
  return choice;
}

// Re-applies the theme when the OS setting changes while "system" is chosen.
export function watchSystemTheme(onChange) {
  const mq = darkQuery();
  if (!mq) return () => {};
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }
  mq.addListener?.(onChange);
  return () => mq.removeListener?.(onChange);
}
