import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";

import { requestPasswordReset } from "../../api/auth";

export function RequestResetPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>();

  // Response is intentionally identical whether or not the account exists.
  const onSubmit = async (values: { email: string }) => {
    await requestPasswordReset(values.email).catch(() => undefined);
    setSent(true);
  };

  if (sent) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="mt-2">
          If that email is registered, a recovery link is on its way. It expires
          in 30 minutes.
        </p>
        <p className="mt-4">
          <Link to="/login" className="text-blue-700 underline">
            Back to sign in
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-6 flex flex-col gap-4"
        noValidate
      >
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded border border-gray-300 p-2"
            aria-invalid={!!errors.email}
            {...register("email", { required: "Email is required." })}
          />
          {errors.email && (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {errors.email.message}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-blue-700 p-2 font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? "Sending…" : "Send recovery link"}
        </button>
      </form>
    </main>
  );
}
