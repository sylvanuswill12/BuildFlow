import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Theme = "light" | "dark";
export type ThemePreference = "auto" | Theme;

interface ThemeContextType {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function themeForLocalTime(date = new Date()): Theme {
  const hour = date.getHours();
  return hour >= 7 && hour < 19 ? "light" : "dark";
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultPreference?: ThemePreference;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  defaultPreference = "auto",
  switchable = false,
}: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (!switchable) return defaultTheme;
    const stored = localStorage.getItem(
      "theme-preference"
    ) as ThemePreference | null;
    if (stored === "auto" || stored === "light" || stored === "dark")
      return stored;
    const legacy = localStorage.getItem("theme") as Theme | null;
    return legacy === "light" || legacy === "dark" ? legacy : defaultPreference;
  });
  const [clock, setClock] = useState(() => new Date());
  const theme = preference === "auto" ? themeForLocalTime(clock) : preference;

  useEffect(() => {
    if (preference !== "auto") return;
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [preference]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    root.dataset.themePreference = preference;
    root.style.colorScheme = theme;
    if (switchable) localStorage.setItem("theme-preference", preference);
  }, [preference, switchable, theme]);

  const setPreference = (next: ThemePreference) => {
    if (switchable) setPreferenceState(next);
  };
  const toggleTheme = switchable
    ? () =>
        setPreferenceState(current =>
          current === "light" ? "dark" : current === "dark" ? "auto" : "light"
        )
    : undefined;

  const value = useMemo(
    () => ({ theme, preference, setPreference, toggleTheme, switchable }),
    [theme, preference, toggleTheme, switchable]
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
