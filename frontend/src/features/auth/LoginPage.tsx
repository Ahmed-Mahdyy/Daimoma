import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Languages, Moon, Sun } from "lucide-react";

import { useLanguage } from "../../app/LanguageProvider";
import { useTheme } from "../../app/ThemeProvider";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "../../api/client";
import { login } from "../../api/auth";
import { useAuth } from "./auth-context";

interface FormValues {
  email: string;
  password: string;
}

const HERO_SLIDES = [
  { line: "login.heroLine", sub: "login.heroSub" },
  { line: "login.hero2Line", sub: "login.hero2Sub" },
  { line: "login.hero3Line", sub: "login.hero3Sub" },
] as const;
// Shared demo-seed password — must match DEMO_SEED_PASSWORD on the server.
// In dev builds it also works with seed_e2e.py when E2E_SEED_PASSWORD matches.
const DEMO_PASSWORD = "Daimoma2026Demo";
const SHOW_DEMO_PANEL = import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGIN === "1";

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const { mode, toggle } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    if (
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const id = setInterval(
      () => setSlide((s) => (s + 1) % HERO_SLIDES.length),
      6000,
    );
    return () => clearInterval(id);
  }, [paused]);

  const doLogin = async (email: string, password: string) => {
    setError(null);
    try {
      await login(email, password);
      await refresh();
      navigate("/", { replace: true });
    } catch (e) {
      if (e instanceof ApiError) {
        setError(
          e.code === "rate_limited"
            ? t("login.rateLimited")
            : t("login.badCredentials"),
        );
      } else {
        setError(t("login.genericError"));
      }
    }
  };

  const onSubmit = (values: FormValues) => doLogin(values.email, values.password);

  const onDemoPick = (email: string) => {
    // One-click demo sign-in; if a custom seed password is configured the
    // login fails gracefully and the email stays filled for manual entry.
    setValue("email", email);
    void doLogin(email, DEMO_PASSWORD);
  };

  return (
    <main className="login-screen grid min-h-screen bg-[#f4f8f5] lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#103e3a] p-12 text-white lg:flex xl:p-20">
        <img src="/brand/logo-icon.png" alt="" aria-hidden="true" className="absolute -right-28 -top-28 h-[30rem] w-auto opacity-[.07]" />
        <div className="absolute bottom-12 right-12 h-64 w-64 rounded-full bg-gold-500/15 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-center gap-5"><img src="/brand/logo-icon.png" alt="" className="h-24 w-24 rounded-3xl bg-white p-2 shadow-xl shadow-black/15" /><span className="text-5xl font-bold tracking-tight">{t("brand.name")}</span></div>
        <div className="relative max-w-xl" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}><span className="text-xs font-bold uppercase tracking-[.2em] text-[#b7d9cd]">{t("login.peopleWorkspace")}</span><div className="mt-6 grid" aria-live="polite">
          {HERO_SLIDES.map((s, i) => (
            <div key={s.line} aria-hidden={i !== slide} className={`col-start-1 row-start-1 transition-opacity duration-700 motion-reduce:transition-none motion-reduce:duration-0 ${i === slide ? "opacity-100" : "pointer-events-none opacity-0"}`}><p className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">{t(s.line)}</p><p className="mt-6 max-w-md text-base leading-7 text-[#c6dfd5]">{t(s.sub)}</p></div>
          ))}
        </div><div className="mt-12 flex gap-3">{HERO_SLIDES.map((s, i) => (<button key={s.line} type="button" aria-label={t("login.slide", { n: i + 1 })} aria-current={i === slide} onClick={() => setSlide(i)} className={`h-1.5 rounded-full transition-[width,background-color] ${i === slide ? "w-10 bg-[#e6bf71]" : "w-3 bg-white/30 hover:bg-white/60"}`} />))}</div></div>
        <p className="relative text-xs font-medium text-[#a9c9bd]">{t("login.footer")}</p>
      </div>
      <div className="flex min-w-0 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
        <div className="login-card mx-auto w-full max-w-md rounded-3xl border border-[#e3ebe6] bg-white p-6 shadow-[0_24px_70px_#1b4d3920] sm:p-10">
      <div className="mb-8 flex items-center justify-center lg:hidden"><img src={lang === "ar" ? "/brand/logo-ar.png" : "/brand/logo-en.png"} alt={t("brand.name")} className="h-28 w-auto dark:hidden" /><img src={lang === "ar" ? "/brand/logo-ar-dark.png" : "/brand/logo-en-dark.png"} alt="" aria-hidden="true" className="hidden h-28 w-auto dark:block" /></div>
      <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-[.16em] text-brand-700">{t("login.welcomeBack")}</span><div className="flex items-center gap-1"><Button type="button" size="icon" variant="ghost" aria-label={lang === "en" ? t("shell.languageToArabic") : t("shell.languageToEnglish")} title={lang === "en" ? t("shell.languageToArabic") : t("shell.languageToEnglish")} onClick={() => setLang(lang === "en" ? "ar" : "en")}><Languages className="size-4" /></Button><Button type="button" size="icon" variant="ghost" aria-label={mode === "dark" ? t("shell.themeToLight") : t("shell.themeToDark")} onClick={toggle}>{mode === "dark" ? <Sun /> : <Moon />}</Button></div></div>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{t("login.signIn")}</h1>
      <p className="mt-2 text-sm text-slate-600">{t("login.tagline")}</p>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-8 flex flex-col gap-5"
        noValidate
      >
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            {t("login.email")}
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-[#fbfdfb] px-4 py-3 text-sm outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            aria-invalid={!!errors.email}
            {...register("email", { required: "Email is required." })}
          />
          {errors.email && (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {errors.email.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            {t("login.password")}
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-[#fbfdfb] px-4 py-3 text-sm outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            aria-invalid={!!errors.password}
            {...register("password", { required: t("Password is required.") })}
          />
          {errors.password && (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {errors.password.message}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-brand-700/20 transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-brand-800 disabled:opacity-60 motion-reduce:transform-none"
        >
          {isSubmitting ? t("login.signingIn") : t("login.signIn")}
        </Button>
      </form>
      {SHOW_DEMO_PANEL && (
        <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-800">{t("Local demo accounts")}</p>
          <p className="mt-1 text-xs text-slate-600">{t("Pick a role to sign in instantly with the local seed password.")}</p>
          <p className="mt-1 text-xs text-slate-600">{t("Shared demo password:")} <code className="rounded bg-white px-1 font-mono">{DEMO_PASSWORD}</code></p>
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ["Employee", "ahmed.refaat@acme.test"],
              ["Manager", "dina.mansour@acme.test"],
              ["HR", "hr-1@acme.test"],
            ] as const).map(([role, email]) => (
              <Button key={role} type="button" size="sm" variant="outline" onClick={() => onDemoPick(email)} aria-label={t("Use {role} demo account", { role })}>{role === "HR" ? "HR" : t(role)}</Button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/reset-password" className="font-semibold workspace-link-quiet">
          {t("login.forgot")}
        </Link>
      </p>
        </div>
        <p className="mx-auto mt-6 text-center text-xs text-slate-600">{t("Secure access for your team")}</p>
      </div>
    </main>
  );
}
