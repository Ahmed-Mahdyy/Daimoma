import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";

import { ApiError } from "../../api/client";
import { acceptInvitation, confirmPasswordReset } from "../../api/auth";

interface FormValues {
  password: string;
  confirm: string;
}

const RULES = {
  required: "Password is required.",
  minLength: { value: 12, message: "At least 12 characters." },
  validate: (v: string) =>
    (/[a-z]/.test(v) && /[A-Z]/.test(v) && /[0-9]/.test(v)) ||
    "Needs an uppercase letter, a lowercase letter, and a digit.",
};

/** Shared set-password form for both invitation acceptance and recovery
 * confirmation — both post {token, password} to their own endpoint. */
export function SetPasswordPage({ mode }: { mode: "invitation" | "reset" }) {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const fn = mode === "invitation" ? acceptInvitation : confirmPasswordReset;
      await fn(token, values.password);
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.code === "invalid_token") {
        setError("This link is invalid or has expired. Request a new one.");
      } else if (e instanceof ApiError && e.fieldErrors?.password) {
        setError("Password does not meet the requirements.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  if (!token) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p role="alert">This link is missing its token. Check the emailed link.</p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-2xl font-semibold">Password set</h1>
        <p className="mt-2">
          Your password is saved.{" "}
          <Link to="/login" className="text-brand-700 underline">
            Sign in
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold">
        {mode === "invitation" ? "Welcome to Daimoma" : "Set a new password"}
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Minimum 12 characters with an uppercase letter, a lowercase letter, and
        a digit.
      </p>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-6 flex flex-col gap-4"
        noValidate
      >
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className="mt-1 w-full rounded border border-gray-300 p-2"
            aria-invalid={!!errors.password}
            {...register("password", RULES)}
          />
          {errors.password && (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {errors.password.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            className="mt-1 w-full rounded border border-gray-300 p-2"
            aria-invalid={!!errors.confirm}
            {...register("confirm", {
              required: "Please repeat the password.",
              validate: (v) => v === getValues("password") || "Passwords must match.",
            })}
          />
          {errors.confirm && (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {errors.confirm.message}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-brand-700 p-2 font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? "Saving…" : "Set password"}
        </button>
      </form>
    </main>
  );
}
