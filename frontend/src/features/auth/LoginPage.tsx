import { useState } from "react";
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

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const { mode, toggle } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await login(values.email, values.password);
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

  return (
    <main className="login-screen grid min-h-screen bg-[#f4f8f5] lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#103e3a] p-12 text-white lg:flex xl:p-20">
        <div className="absolute -right-32 -top-32 h-[34rem] w-[34rem] rounded-full border-[70px] border-white/5" aria-hidden="true" />
        <div className="absolute bottom-12 right-12 h-64 w-64 rounded-full bg-gold-500/15 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-center gap-3"><img src="/brand/logo-icon.svg" alt="" className="h-11 w-11 rounded-xl bg-white p-1" /><span className="text-xl font-bold tracking-tight">Daimoma</span></div>
        <div className="relative max-w-xl"><span className="text-xs font-bold uppercase tracking-[.2em] text-[#b7d9cd]">{t("login.peopleWorkspace")}</span><p className="mt-6 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">{t("login.heroLine")}</p><p className="mt-6 max-w-md text-base leading-7 text-[#c6dfd5]">{t("login.heroSub")}</p><div className="mt-12 flex gap-3"><span className="h-1.5 w-10 rounded-full bg-[#e6bf71]" /><span className="h-1.5 w-3 rounded-full bg-white/30" /><span className="h-1.5 w-3 rounded-full bg-white/30" /></div></div>
        <p className="relative text-xs font-medium text-[#a9c9bd]">{t("login.footer")}</p>
      </div>
      <div className="flex min-w-0 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
        <div className="login-card mx-auto w-full max-w-md rounded-3xl border border-[#e3ebe6] bg-white p-6 shadow-[0_24px_70px_#1b4d3920] sm:p-10">
      <div className="mb-8 flex items-center gap-3 lg:hidden"><img src="/brand/logo-icon.svg" alt="" className="h-10 w-10" /><span className="text-lg font-bold text-brand-800">Daimoma</span></div>
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
      {import.meta.env.DEV && (
        <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-800">{t("Local demo accounts")}</p>
          <p className="mt-1 text-xs text-slate-600">{t("Choose a role to fill the email. Use the password configured for your local seed.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ["Employee", "employee-e2e@acme.test"],
              ["Manager", "manager-e2e@acme.test"],
              ["HR", "hr-e2e@acme.test"],
            ] as const).map(([role, email]) => (
              <Button key={role} type="button" size="sm" variant="outline" onClick={() => setValue("email", email)} aria-label={t("Choose {role} demo account", { role })}>{role === "HR" ? "HR" : t(role)}</Button>
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
