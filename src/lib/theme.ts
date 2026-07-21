import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
const KEY = "zapflow.theme";

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(KEY) as Theme) || "dark";
}

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark");
  root.classList.toggle("light", t === "light");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const t = getInitialTheme();
    setTheme(t);
    applyTheme(t);
  }, []);
  const update = (t: Theme) => {
    setTheme(t);
    localStorage.setItem(KEY, t);
    applyTheme(t);
  };
  return { theme, setTheme: update, toggle: () => update(theme === "dark" ? "light" : "dark") };
}
