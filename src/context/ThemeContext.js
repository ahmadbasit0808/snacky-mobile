import React, { createContext, useContext, useState, useEffect } from "react";
import { getSetting, setSetting } from "../db/database";

export const THEMES = {
  dark: {
    bg: "#121212",
    card: "#1E1E1E",
    cardAlt: "#2A2A2A",
    border: "#333333",
    text: "#FFFFFF",
    textSecondary: "#D1D5DB",
    textMuted: "#9CA3AF",
    tabBar: "#1A1A1A",
    header: "#1A1A1A",
    input: "#2A2A2A",
    placeholder: "#6B7280",
    textrev: "#000000",
  },
  light: {
    bg: "#f2f2f7",
    card: "#ffffff",
    cardAlt: "#f8f8ff",
    border: "#e0e0e0",
    text: "#000000",
    textSecondary: "#555555",
    textMuted: "#999999",
    tabBar: "#ffffff",
    header: "#ffffff",
    input: "#f2f2f7",
    placeholder: "#aaaaaa",
    textrev: "#000000",
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    getSetting("theme").then((val) => {
      if (val !== null) setIsDark(val === "dark");
    });
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await setSetting("theme", next ? "dark" : "light");
  };

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        theme: isDark ? THEMES.dark : THEMES.light,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
