import { useLanguage } from "../../app/LanguageProvider";

/** Marks a list row that belongs to the signed-in viewer (used so managers
 * and HR can spot their own items inside team/org-scoped lists). */
export function YouBadge() {
  const { t } = useLanguage();
  return (
    <span className="ms-1.5 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-white/15 dark:text-slate-100">
      {t("You")}
    </span>
  );
}
