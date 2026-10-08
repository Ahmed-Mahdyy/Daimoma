import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Languages, Menu, Moon, Sun, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "../features/auth/auth-context";
import { NotificationBell } from "../features/notifications/NotificationBell";
import { PunchWidget } from "../features/timesheets/PunchWidget";
import { getOrCreateTimesheet, listTimesheets, type Timesheet } from "../api/timesheets";
import { localToday } from "../lib/dates";
import { useLanguage } from "./LanguageProvider";
import { useTheme } from "./ThemeProvider";
import type { I18nKey } from "../lib/i18n";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `workspace-nav-link ${isActive ? "workspace-nav-active" : ""}`;

const navigation: { to: string; key: I18nKey; icon: string; hr?: boolean; managerOnly?: boolean; elevated?: boolean }[] = [
  { to: "/", key: "nav.home", icon: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" },
  { to: "/timesheets", key: "nav.timesheets", icon: "M5 3v4m14-4v4M4 9h16M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" },
  { to: "/employees", key: "nav.employees", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2h14zm-7-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm9-7a4 4 0 0 1 0 8m0 2a4 4 0 0 1 4 4v2", elevated: true },
  { to: "/departments", key: "nav.departments", icon: "M3 21V7l9-4 9 4v14M3 11h18M8 21v-6h8v6", hr: true },
  { to: "/reports", key: "nav.reports", icon: "M4 20V11m5 9V4m5 16v-7m5 7V8M2 20h20" },
  { to: "/audit", key: "nav.audit", icon: "M12 3a9 9 0 1 0 9 9M12 7v5l3 2", managerOnly: true },
];

/** Settings children — everyone gets Profile; HR adds administration.
 * Managers keep a top-level Audit link instead. */
const HR_SETTINGS_CHILDREN: { to: string; key: I18nKey }[] = [
  { to: "/settings/organization", key: "nav.organization" },
  { to: "/audit", key: "nav.audit" },
];

/** Authenticated shell: brand, role-aware nav, notification bell, sign out. */
export function AppLayout() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mode, toggle } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const openCurrentWeek = useMutation({
    mutationFn: async () => {
      const today = localToday();
      // The caller's own sheet covering today always wins — it may have been
      // created under a previous week-start setting, in which case the
      // create endpoint would refuse it as an overlap.
      const { results } = await listTimesheets({ page_size: 50 });
      const own = results.filter((s) => s.employee_email === user?.email);
      const covering = own.find(
        (s) => s.period_start <= today && today <= s.period_end,
      );
      if (covering) return covering.id;
      try {
        return (await getOrCreateTimesheet(today)).id;
      } catch {
        // A legacy sheet can overlap the computed week's boundary and block
        // creation while nothing covers today — open the nearest own sheet.
        const gap = (s: Timesheet) =>
          today < s.period_start
            ? Date.parse(s.period_start) - Date.parse(today)
            : Date.parse(today) - Date.parse(s.period_end);
        return own.sort((a, b) => gap(a) - gap(b))[0]?.id ?? null;
      }
    },
    onSuccess: (sheetId) => {
      void queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      setMenuOpen(false);
      navigate(sheetId ? `/timesheets/${sheetId}` : "/timesheets");
    },
    onError: () => {
      setMenuOpen(false);
      navigate("/timesheets");
    },
  });
  const roles = user?.roles ?? [];
  const isHr = roles.includes("HR");
  const isManager = roles.includes("Manager");
  const canSeeAudit = isHr || isManager;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const requestChildren = [
    { to: "/requests/types", key: "nav.requestTypes" as I18nKey },
    { to: "/settings/allocations", key: "nav.allocations" as I18nKey },
  ];
  const requestsActive = requestChildren.some((child) => pathname === child.to || pathname.startsWith(`${child.to}/`));
  const showRequestChildren = requestsOpen || requestsActive;
  const settingsChildren = [
    { to: "/profile", key: "nav.profile" as I18nKey },
    ...(isHr ? HR_SETTINGS_CHILDREN : []),
  ];
  const settingsActive = settingsChildren.some(
    (c) => pathname === c.to || pathname.startsWith(`${c.to}/`),
  );
  const showSettingsChildren = settingsOpen || settingsActive;
  const visibleLinks = navigation.filter(
    (item) =>
      (!item.hr || isHr) &&
      (!item.managerOnly || (isManager && !isHr)) &&
      (!item.elevated || isHr || isManager),
  );
  const name = user?.display_name || user?.email || "Account";

  return (
    <div className="workspace min-h-screen lg:flex">
      <a href="#main-content" className="skip-link">{t("nav.skipToContent")}</a>
      <aside id="workspace-navigation" className={`workspace-sidebar ${menuOpen ? "workspace-sidebar-open" : ""}`}>
        <Link to="/" className="workspace-brand" aria-label={t("nav.daimomaHome")}><span className="workspace-brand-mark"><img src="/brand/logo-icon.png" alt="" className="dark:hidden" /><img src="/brand/logo-icon-dark.png" alt="" className="hidden dark:block" /></span><span><strong>{t("brand.name")}</strong><small>{t("shell.yourWorkspace")}</small></span></Link>
        <div className="workspace-sidebar-inner">
          <p className="workspace-nav-heading">{t("nav.workspace")}</p>
          <nav aria-label={t("nav.main")} className="workspace-nav">
            {visibleLinks.filter(({ to }) => to === "/" || to === "/timesheets").map(({ to, key, icon }) => (
              <NavLink key={to} to={to} end={to === "/"} className={linkClass} onClick={() => setMenuOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg><span>{t(key)}</span>
              </NavLink>
            ))}
            <div>
              <div className="flex items-center gap-1">
                <NavLink to="/requests" end className={`${linkClass({ isActive: pathname === "/requests" })} flex-1`} onClick={() => setMenuOpen(false)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3h8l5 5v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4zm0 0v6h12M8 14h8m-8 4h6" /></svg><span>{t("nav.requests")}</span>
                </NavLink>
                {isHr && <button type="button" aria-expanded={showRequestChildren} aria-label={showRequestChildren ? t("nav.collapseRequests") : t("nav.expandRequests")} onClick={() => setRequestsOpen((v) => !v)} className="workspace-nav-link !min-h-0 w-9 justify-center !px-0 py-2"><ChevronRight className={`size-4 transition-transform rtl:-scale-x-100 ${showRequestChildren ? "rotate-90" : ""}`} aria-hidden="true" /></button>}
              </div>
              {isHr && showRequestChildren && <nav aria-label={t("nav.requestsMenu")} className="workspace-settings-nav ms-9 grid gap-0.5 border-s ps-2">
                {requestChildren.map((child) => <NavLink key={child.to} to={child.to} end={child.to === "/requests"} className={linkClass} onClick={() => setMenuOpen(false)}><span className="text-[0.83rem]">{t(child.key)}</span></NavLink>)}
              </nav>}
            </div>
            {visibleLinks.filter(({ to }) => to !== "/" && to !== "/timesheets").map(({ to, key, icon }) => (
              <NavLink key={to} to={to} className={linkClass} onClick={() => setMenuOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg><span>{t(key)}</span>
              </NavLink>
            ))}
            <div>
              <div className="flex items-center gap-1">
                {isHr ? (
                  <NavLink to="/settings" end className={`${linkClass({ isActive: pathname === "/settings" })} flex-1`} onClick={() => setMenuOpen(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-12 2 2.2 2.8-.3.6 2.7 2.6 1.2-1 2.6-1.2-.6-2.7-2.8.3z" /></svg><span>{t("nav.settings")}</span>
                  </NavLink>
                ) : (
                  <button
                    type="button"
                    aria-expanded={showSettingsChildren}
                    onClick={() => setSettingsOpen((v) => !v)}
                    className="workspace-nav-link flex-1"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-12 2 2.2 2.8-.3.6 2.7 2.6 1.2-1 2.6-1.2-.6-2.7-2.8.3z" /></svg><span>{t("nav.settings")}</span>
                  </button>
                )}
                <button
                  type="button"
                  aria-expanded={showSettingsChildren}
                  aria-label={showSettingsChildren ? t("nav.collapseSettings") : t("nav.expandSettings")}
                  onClick={() => setSettingsOpen((v) => !v)}
                  className="workspace-nav-link !min-h-0 w-9 justify-center !px-0 py-2"
                >
                  <ChevronRight className={`size-4 transition-transform rtl:-scale-x-100 ${showSettingsChildren ? "rotate-90" : ""}`} aria-hidden="true" />
                </button>
              </div>
              {showSettingsChildren && (
                <nav aria-label={t("nav.settingsMenu")} className="workspace-settings-nav ms-9 grid gap-0.5 border-s ps-2">
                  {settingsChildren.map((child) => (
                    <NavLink key={child.to} to={child.to} end={child.to === "/settings"} className={linkClass} onClick={() => setMenuOpen(false)}>
                      <span className="text-[0.83rem]">{t(child.key)}</span>
                    </NavLink>
                  ))}
                </nav>
              )}
            </div>
          </nav>
          <div className="workspace-sidebar-bottom"><p className="workspace-nav-heading">{t("nav.quickActions")}</p><nav aria-label={t("nav.quickActions")} className="workspace-nav"><button type="button" className="workspace-nav-link" disabled={openCurrentWeek.isPending} onClick={() => openCurrentWeek.mutate()}>{t("nav.currentTimesheet")}</button>{isHr && (<><Link className="workspace-nav-link" to="/employees/new" onClick={() => setMenuOpen(false)}>{t("nav.addEmployee")}</Link><Link className="workspace-nav-link" to="/departments" onClick={() => setMenuOpen(false)}>{t("nav.manageDepartments")}</Link></>)}</nav></div>
          <div className="workspace-sidebar-bottom"><div className="workspace-profile"><Avatar>{user?.photo_url && <AvatarImage src={user.photo_url} alt="" />}<AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><span className="min-w-0"><strong className="block truncate text-sm">{name}</strong><small className="block truncate">{isHr ? "HR" : canSeeAudit ? "Manager" : "Employee"}</small></span></div><button type="button" onClick={() => void signOut()} className="workspace-signout">{t("shell.signOut")} <span aria-hidden="true">↗</span></button></div>
        </div>
      </aside>
      {menuOpen && (
        <button
          type="button"
          aria-label={t("nav.closeMenu")}
          className="workspace-nav-backdrop lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="workspace-stage min-w-0 flex-1">
        <header className="workspace-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <Button type="button" variant="outline" size="icon" aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")} aria-expanded={menuOpen} aria-controls="workspace-navigation" onClick={() => setMenuOpen((value) => !value)} className="lg:hidden">{menuOpen ? <X /> : <Menu />}</Button>
            <span className="workspace-mobile-brand hidden min-[430px]:inline lg:hidden">{t("brand.name")}</span>

          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2"><PunchWidget /><Button type="button" variant="ghost" size="icon" aria-label={lang === "en" ? t("shell.languageToArabic") : t("shell.languageToEnglish")} title={lang === "en" ? t("shell.languageToArabic") : t("shell.languageToEnglish")} onClick={() => setLang(lang === "en" ? "ar" : "en")}><Languages className="size-4" /><span className="sr-only">{t("shell.language")}</span></Button><Button type="button" variant="ghost" size="icon" aria-label={mode === "dark" ? t("shell.themeToLight") : t("shell.themeToDark")} onClick={toggle}>{mode === "dark" ? <Sun /> : <Moon />}</Button><NotificationBell /><DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={t("shell.accountMenu")} className="cursor-pointer rounded-full ring-[#c9a227]/50 transition hover:ring-4 data-[state=open]:ring-4"><Avatar className="size-8">{user?.photo_url && <AvatarImage src={user.photo_url} alt="" />}<AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64"><DropdownMenuLabel><strong className="block truncate">{name}</strong><span className="block truncate text-xs font-normal text-muted-foreground">{user?.email}</span><Badge className="mt-2" variant="secondary">{isHr ? "HR" : canSeeAudit ? "Manager" : "Employee"}</Badge><span className="ms-2 text-xs font-normal text-muted-foreground">{user?.employee_code}</span></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem asChild><Link to="/profile">{t("shell.myProfile")}</Link></DropdownMenuItem>{isHr && <DropdownMenuItem asChild><Link to="/settings">{t("nav.settings")}</Link></DropdownMenuItem>}<DropdownMenuItem onSelect={() => void signOut()}>{t("shell.signOut")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
        </header>
        <main id="main-content" className="workspace-content mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 sm:py-10"><Outlet /></main>
      </div>
    </div>
  );
}
