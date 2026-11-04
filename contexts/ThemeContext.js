"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// theme: the user's choice ("light" | "dark" | "system")
// resolvedTheme: what is actually shown ("light" | "dark")
const ThemeContext = createContext();

const STORAGE_KEY = "theme";
const THEMES = ["light", "dark", "system"];

// The <head> script that applies the theme before paint lives in lib/themeScript.js.

const getStoredTheme = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
};

const systemPrefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const applyTheme = (theme) => {
  const isDark = theme === "dark" || (theme === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
  return isDark ? "dark" : "light";
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("system");
  const [resolvedTheme, setResolvedTheme] = useState("light");

  // Read the saved choice once on mount (the head script already applied it)
  useEffect(() => {
    const saved = getStoredTheme();
    setThemeState(saved);
    setResolvedTheme(applyTheme(saved));
  }, []);

  // Follow the operating system setting while "system" is selected
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(applyTheme("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    setThemeState(next);
    setResolvedTheme(applyTheme(next));
  }, []);

  // Kept for existing callers: switches between light and dark
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
