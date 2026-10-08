import { TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useLanguage } from "../../app/LanguageProvider";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Accessible consequential-action dialog: focus trap on mount, Escape
 * cancels, backdrop click cancels. Portalled to <body> so it is not clipped
 * by transformed/filtered ancestors (e.g. the blurred topbar). */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useLanguage();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d2b29]/55 p-4 backdrop-blur-[6px] animate-in fade-in-0 duration-200"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-border/60 bg-popover text-popover-foreground shadow-[0_32px_70px_-16px_rgba(13,43,41,.5)] animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex justify-center px-6 pb-5 pt-8 ${
            danger
              ? "bg-[#fdf1ef] dark:bg-[#2a1714]"
              : "bg-[#ecf4f1] dark:bg-[#142e2b]"
          }`}
        >
          <span className="relative grid size-16 place-items-center rounded-2xl bg-white shadow-md ring-1 ring-slate-900/5 dark:bg-[#10312e] dark:ring-white/10">
            <img
              src="/brand/logo-icon.png"
              alt=""
              aria-hidden="true"
              className="size-9 object-contain dark:hidden"
            />
            <img
              src="/brand/logo-icon-dark.png"
              alt=""
              aria-hidden="true"
              className="hidden size-9 object-contain dark:block"
            />
            {danger && (
              <span className="absolute -bottom-1.5 -end-1.5 grid size-6 place-items-center rounded-full bg-[#b42318] text-white ring-[3px] ring-[#fdf1ef] dark:bg-[#e5484d] dark:ring-[#2a1714]">
                <TriangleAlert className="size-3.5" aria-hidden="true" />
              </span>
            )}
          </span>
        </div>
        <div className="px-6 pb-6 pt-5 text-center">
          <h2
            id="confirm-title"
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50"
          >
            {title}
          </h2>
          <p
            id="confirm-body"
            className="mx-auto mt-2 max-w-[30ch] text-sm leading-relaxed text-muted-foreground"
          >
            {body}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-accent dark:text-slate-200"
            >
              {cancelLabel ?? t("Cancel")}
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 ${
                danger
                  ? "bg-[#b42318] hover:bg-[#932018] focus-visible:ring-[#b42318]/60 dark:bg-[#e5484d] dark:hover:bg-[#c73a3f]"
                  : "bg-brand-700 hover:bg-brand-800 focus-visible:ring-brand-600/60"
              }`}
            >
              {confirmLabel ?? t("Confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
