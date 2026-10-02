import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "react-router-dom";
import { Camera } from "lucide-react";

import { ApiError, apiErrorMessage } from "../../api/client";
import {
  changePassword,
  updateMe,
  uploadMyPhoto,
} from "../../api/auth";
import { useAuth } from "../auth/auth-context";
import { useLanguage } from "../../app/LanguageProvider";
import { Alert } from "../../components/ui/Alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProfileForm {
  display_name: string;
  phone: string;
  preferred_locale: string;
}

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm: string;
}

const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp";

export function SettingsPage() {
  const { user, refresh, signOut } = useAuth();
  const { t } = useLanguage();
  const isSettings = useLocation().pathname === "/settings";
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const profileForm = useForm<ProfileForm>({
    values: {
      display_name: user?.display_name ?? "",
      phone: user?.phone ?? "",
      preferred_locale: user?.preferred_locale ?? "en",
    },
  });
  const passwordForm = useForm<PasswordForm>();

  const onProfileSubmit = async (values: ProfileForm) => {
    setProfileMsg(null);
    setProfileError(null);
    try {
      await updateMe({ ...values, version: user?.version });
      await refresh();
      setProfileMsg(t("Profile saved."));
    } catch (e) {
      setProfileError(
        e instanceof ApiError && e.code === "state_conflict"
          ? t("Your profile changed elsewhere. Refresh and try again.")
          : t("Could not save. Please try again."),
      );
    }
  };

  const onPhotoChosen = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      await uploadMyPhoto(file);
      await refresh();
    } catch (e) {
      setPhotoError(apiErrorMessage(e));
    } finally {
      setPhotoBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onPasswordSubmit = async (values: PasswordForm) => {
    setPasswordMsg(null);
    setPasswordError(null);
    try {
      await changePassword(values.current_password, values.new_password);
      setPasswordMsg(t("Password changed. Other sessions were signed out."));
      passwordForm.reset();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setPasswordError(t("Current password is incorrect."));
      } else if (e instanceof ApiError && e.fieldErrors) {
        setPasswordError(t("New password does not meet the requirements."));
      } else {
        setPasswordError(t("Could not change password. Please try again."));
      }
    }
  };

  if (!user) return null;

  const name = user.display_name || user.email;
  const role = user.roles.includes("HR")
    ? "HR"
    : user.roles.includes("Manager")
      ? t("Manager")
      : t("Employee");
  const input =
    "mt-1 w-full rounded-md border border-gray-300 p-2 text-sm";

  return (
    <div className="flex flex-col gap-6">
      {/* Unified profile hero: banner + photo actions + details in one card,
          so the avatar appears once. */}
      <Card className="overflow-hidden border-brand-100">
        <div className="relative bg-gradient-to-r from-[#103e3a] to-[#14554d] px-6 py-7 text-white">
          <div
            className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full border-[22px] border-white/10"
            aria-hidden="true"
          />
          <div className="relative flex flex-wrap items-center gap-5">
            <div className="relative shrink-0">
              <Avatar className="size-20 ring-2 ring-white/40">
                {user.photo_url && <AvatarImage src={user.photo_url} alt="" />}
                <AvatarFallback className="text-2xl">
                  {name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                aria-label={t("Change profile photo")}
                disabled={photoBusy}
                onClick={() => fileInput.current?.click()}
                className="absolute -bottom-1 -end-1 rounded-full bg-white p-1.5 text-[#14554d] shadow-md transition hover:scale-105 disabled:opacity-50"
              >
                <Camera className="size-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold">
                {isSettings ? t("Settings") : t("My profile")}
              </h1>
              <p className="truncate text-sm text-[#cfe4dd]">{user.email}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge variant="secondary">{role}</Badge>
                <span className="text-xs text-[#a9cfc4]">
                  {user.employee_code}
                </span>
              </div>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept={PHOTO_ACCEPT}
              className="sr-only"
              aria-label={t("Choose profile photo")}
              onChange={(e) => void onPhotoChosen(e.target.files?.[0])}
            />
          </div>
        </div>
        <CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">
            {t("PNG, JPEG, or WebP — up to 2 MiB. Your photo is shown across the workspace.")}
          </p>
          {photoError && (
            <div className="mt-3">
              <Alert kind="error">{photoError}</Alert>
            </div>
          )}
          {isSettings && user.roles.includes("HR") && (
            <div className="mt-3">
              <Link to="/settings/organization" className="workspace-link text-sm">
                {t("Organization settings (HR)")}
              </Link>
            </div>
          )}

          <form
            onSubmit={profileForm.handleSubmit(onProfileSubmit)}
            className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div>
              <label htmlFor="display_name" className="block text-sm font-medium">
                {t("Display name")}
              </label>
              <input
                id="display_name"
                className={input}
                {...profileForm.register("display_name")}
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium">
                {t("Phone")}
              </label>
              <input
                id="phone"
                type="tel"
                className={input}
                {...profileForm.register("phone")}
              />
            </div>
            <div>
              <label
                htmlFor="preferred_locale"
                className="block text-sm font-medium"
              >
                {t("Language")}
              </label>
              <select
                id="preferred_locale"
                className={input}
                {...profileForm.register("preferred_locale")}
              >
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button type="submit">{t("Save profile")}</Button>
            </div>
            {profileMsg && (
              <div className="sm:col-span-2">
                <Alert kind="success">{profileMsg}</Alert>
              </div>
            )}
            {profileError && (
              <div className="sm:col-span-2">
                <Alert kind="error">{profileError}</Alert>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Change password")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
            className="flex flex-col gap-4"
          >
            <div>
              <label
                htmlFor="current_password"
                className="block text-sm font-medium"
              >
                {t("Current password")}
              </label>
              <input
                id="current_password"
                type="password"
                autoComplete="current-password"
                className={input}
                {...passwordForm.register("current_password", {
                  required: t("Current password is required."),
                })}
              />
            </div>
            <div>
              <label htmlFor="new_password" className="block text-sm font-medium">
                {t("New password")}
              </label>
              <input
                id="new_password"
                type="password"
                autoComplete="new-password"
                className={input}
                {...passwordForm.register("new_password", {
                  required: t("New password is required."),
                  minLength: { value: 12, message: t("At least 12 characters.") },
                  validate: (v) =>
                    (/[a-z]/.test(v) && /[A-Z]/.test(v) && /[0-9]/.test(v)) ||
                    t("Needs an uppercase letter, a lowercase letter, and a digit."),
                })}
              />
              {passwordForm.formState.errors.new_password && (
                <p role="alert" className="mt-1 text-sm text-red-700">
                  {passwordForm.formState.errors.new_password.message}
                </p>
              )}
            </div>
            {passwordError && <Alert kind="error">{passwordError}</Alert>}
            {passwordMsg && <Alert kind="success">{passwordMsg}</Alert>}
            <Button type="submit" className="self-start">
              {t("Change password")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <Button variant="outline" onClick={() => void signOut()}>
          {t("Sign out")}
        </Button>
      </div>
    </div>
  );
}
