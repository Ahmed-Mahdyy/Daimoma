import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface ThemeContextValue {
  mode: "light" | "dark";
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<"light" | "dark">(() =>
    localStorage.getItem("daimoma-theme") === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem("daimoma-theme", mode);
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggle: () => setMode((value) => value === "dark" ? "light" : "dark") }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeProvider is missing");
  return context;
}
