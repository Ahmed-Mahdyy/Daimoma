import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

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
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
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
            ? "Too many attempts. Please wait a few minutes."
            : "The email or password is incorrect.",
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold">Sign in to Daimoma</h1>
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
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-gray-300 p-2"
            aria-invalid={!!errors.password}
            {...register("password", { required: "Password is required." })}
          />
          {errors.password && (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {errors.password.message}
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
          className="rounded bg-blue-700 p-2 font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link to="/reset-password" className="text-blue-700 underline">
          Forgot your password?
        </Link>
      </p>
    </main>
  );
}
