import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { setDateLocale } from "../lib/dates";
import {
  translate,
  type Language,
} from "../lib/i18n";

interface LanguageContextValue {
  lang: Language;
  dir: "ltr" | "rtl";
  setLang: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** EN/AR locale provider (D-002): persists the choice, sets <html lang/dir>
 * so the shell flips to RTL, and exposes t() for translated strings. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() =>
    localStorage.getItem("daimoma-lang") === "ar" ? "ar" : "en",
  );
  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem("daimoma-lang", lang);
    setDateLocale(lang);
  }, [lang, dir]);

  return (
    <LanguageContext.Provider
      value={{
        lang,
        dir,
        setLang,
        t: (key, params) => translate(lang, key, params),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  // Fall back to English outside the provider so shared components still
  // render in isolated unit tests without a wrapper.
  return (
    context ?? {
      lang: "en" as Language,
      dir: "ltr" as const,
      setLang: () => {},
      t: (key: string, params?: Record<string, string | number>) =>
        translate("en", key, params),
    }
  );
}
