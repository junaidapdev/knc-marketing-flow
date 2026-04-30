import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navigate, useNavigate, useLocation, type Location } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ROUTES } from "../constants/routes";
import { useAuthStore } from "../stores/auth-store";
import { logger } from "../utils/logger";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type LoginInput = z.infer<typeof loginSchema>;

function BrandMark(): JSX.Element {
  return (
    <div className="relative w-10 h-10 rounded-[10px] bg-obsidian grid place-items-center">
      <span
        aria-hidden
        className="absolute inset-[7px] rounded-[6px] bg-yellow"
        style={{
          clipPath: "polygon(0 0, 100% 0, 100% 50%, 50% 50%, 50% 100%, 0 100%)",
        }}
      />
    </div>
  );
}

export default function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  // ProtectedRoute redirects unauthenticated users here with state.from set
  // to the location they actually wanted. We honor that on success so a
  // refresh on /calendar lands back on /calendar — not always Today.
  const fromState = location.state as { from?: Location } | null;
  const redirectTo = fromState?.from?.pathname ?? ROUTES.TODAY;

  // If auto-login (or a previously persisted session) is still resolving, show
  // a hold screen instead of flashing the login form. Once isLoading flips,
  // either we have a session (redirect away) or we don't (show the form).
  useEffect(() => {
    if (!isLoading && session) navigate(redirectTo, { replace: true });
  }, [isLoading, session, navigate, redirectTo]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warmbg text-ink-2">
        Loading…
      </div>
    );
  }
  if (session) return <Navigate to={redirectTo} replace />;

  const onSubmit = async (input: LoginInput): Promise<void> => {
    setSubmitError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error) {
      logger.warn("login failed", { message: error.message });
      setSubmitError(error.message);
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-warmbg p-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="card w-full max-w-md p-9 space-y-5 shadow-md"
      >
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <div className="font-serif text-[20px] tracking-tight text-ink leading-none">
              Kayan<em className="not-italic text-ink-2">.os</em>
            </div>
            <div className="eyebrow mt-0.5">Marketing</div>
          </div>
        </div>

        <div className="pt-2">
          <h1 className="font-serif text-[24px] tracking-tight text-ink leading-tight">
            Welcome back, <em>let's plan</em>
          </h1>
          <p className="text-[13px] text-ink-2 mt-1.5">
            Sign in to your Kayan Marketing OS workspace.
          </p>
        </div>

        <div>
          <label className="field-label">Email</label>
          <input type="email" {...register("email")} className="form-input" />
          {errors.email && (
            <p className="text-[12px] text-rose-deep mt-1.5">{errors.email.message}</p>
          )}
        </div>
        <div>
          <label className="field-label">Password</label>
          <input type="password" {...register("password")} className="form-input" />
          {errors.password && (
            <p className="text-[12px] text-rose-deep mt-1.5">{errors.password.message}</p>
          )}
        </div>
        {submitError && (
          <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] px-3 py-2 text-[12.5px]">
            {submitError}
          </div>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary w-full justify-center disabled:opacity-50"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
