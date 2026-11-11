import { useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";

const KEY = "comparo-theme";

function storedMode(): ThemeMode {
  const value = localStorage.getItem(KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(storedMode);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = mode === "dark" || (mode === "system" && media.matches);
      root.classList.toggle("dark", dark);
    };
    apply();
    localStorage.setItem(KEY, mode);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [mode]);

  function cycle() {
    setMode((current) => (current === "system" ? "dark" : current === "dark" ? "light" : "system"));
  }

  return { mode, cycle };
}
