import { useState } from "react";
import { useForm } from "react-hook-form";

import { ApiError } from "../../api/client";
import { changePassword, updateMe } from "../../api/auth";
import { useAuth } from "../auth/auth-context";

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

export function SettingsPage() {
  const { user, refresh, signOut } = useAuth();
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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
    try {
      await updateMe({ ...values, version: user?.version });
      await refresh();
      setProfileMsg("Profile saved.");
    } catch (e) {
      setProfileMsg(
        e instanceof ApiError && e.code === "state_conflict"
          ? "Your profile changed elsewhere. Refresh and try again."
          : "Could not save. Please try again.",
      );
    }
  };

  const onPasswordSubmit = async (values: PasswordForm) => {
    setPasswordMsg(null);
    setPasswordError(null);
    try {
      await changePassword(values.current_password, values.new_password);
      setPasswordMsg("Password changed. Other sessions were signed out.");
      passwordForm.reset();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setPasswordError("Current password is incorrect.");
      } else if (e instanceof ApiError && e.fieldErrors) {
        setPasswordError("New password does not meet the requirements.");
      } else {
        setPasswordError("Could not change password. Please try again.");
      }
    }
  };

  if (!user) return null;

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section aria-labelledby="profile-heading" className="mt-8">
        <h2 id="profile-heading" className="text-lg font-medium">
          Profile
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {user.email} · {user.employee_code}
        </p>
        <form
          onSubmit={profileForm.handleSubmit(onProfileSubmit)}
          className="mt-4 flex flex-col gap-4"
        >
          <div>
            <label htmlFor="display_name" className="block text-sm font-medium">
              Display name
            </label>
            <input
              id="display_name"
              className="mt-1 w-full rounded border border-gray-300 p-2"
              {...profileForm.register("display_name")}
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              className="mt-1 w-full rounded border border-gray-300 p-2"
              {...profileForm.register("phone")}
            />
          </div>
          <div>
            <label htmlFor="preferred_locale" className="block text-sm font-medium">
              Language
            </label>
            <select
              id="preferred_locale"
              className="mt-1 w-full rounded border border-gray-300 p-2"
              {...profileForm.register("preferred_locale")}
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          {profileMsg && (
            <p role="status" className="text-sm text-green-700">
              {profileMsg}
            </p>
          )}
          <button
            type="submit"
            className="self-start rounded bg-blue-700 px-4 py-2 font-medium text-white"
          >
            Save profile
          </button>
        </form>
      </section>

      <section aria-labelledby="password-heading" className="mt-10">
        <h2 id="password-heading" className="text-lg font-medium">
          Change password
        </h2>
        <form
          onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
          className="mt-4 flex flex-col gap-4"
        >
          <div>
            <label
              htmlFor="current_password"
              className="block text-sm font-medium"
            >
              Current password
            </label>
            <input
              id="current_password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded border border-gray-300 p-2"
              {...passwordForm.register("current_password", {
                required: "Current password is required.",
              })}
            />
          </div>
          <div>
            <label htmlFor="new_password" className="block text-sm font-medium">
              New password
            </label>
            <input
              id="new_password"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded border border-gray-300 p-2"
              {...passwordForm.register("new_password", {
                required: "New password is required.",
                minLength: { value: 12, message: "At least 12 characters." },
                validate: (v) =>
                  (/[a-z]/.test(v) && /[A-Z]/.test(v) && /[0-9]/.test(v)) ||
                  "Needs an uppercase letter, a lowercase letter, and a digit.",
              })}
            />
            {passwordForm.formState.errors.new_password && (
              <p role="alert" className="mt-1 text-sm text-red-700">
                {passwordForm.formState.errors.new_password.message}
              </p>
            )}
          </div>
          {passwordError && (
            <p role="alert" className="text-sm text-red-700">
              {passwordError}
            </p>
          )}
          {passwordMsg && (
            <p role="status" className="text-sm text-green-700">
              {passwordMsg}
            </p>
          )}
          <button
            type="submit"
            className="self-start rounded bg-blue-700 px-4 py-2 font-medium text-white"
          >
            Change password
          </button>
        </form>
      </section>

      <button
        onClick={() => void signOut()}
        className="mt-10 rounded border border-gray-400 px-4 py-2"
      >
        Sign out
      </button>
    </main>
  );
}
