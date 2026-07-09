import { useEffect } from "react";
"use client";


import useThemeStore from "@/store/themeStore";

export function ThemeProvider({ children }) {
  const { initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return <>{children}</>;
}
