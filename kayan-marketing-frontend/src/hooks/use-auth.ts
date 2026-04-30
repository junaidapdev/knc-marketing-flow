import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/auth-store";
import { env } from "../config/env";
import { logger } from "../utils/logger";

// Internal tool — when VITE_AUTO_LOGIN_EMAIL/PASSWORD are set, sign in
// automatically on first load so the team never sees the login screen.
// Falls back to the normal login flow if those env vars are missing.
async function ensureSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const email = env.VITE_AUTO_LOGIN_EMAIL;
  const password = env.VITE_AUTO_LOGIN_PASSWORD;
  if (!email || !password) return;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) logger.error("auto-login failed", { message: error.message });
}

export function useAuthInit(): void {
  const setSession = useAuthStore((state) => state.setSession);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    let mounted = true;
    // supabase-js fires onAuthStateChange synchronously on subscribe with an
    // INITIAL_SESSION event — typically containing `null` until the cached
    // session loads from localStorage. If we react to that null event we'll
    // flip `isLoading` to false before our auto-login finishes, the
    // ProtectedRoute then sees no session, and the user gets bounced to
    // /login. Skip that one specific event; ensureSession() below will
    // produce the authoritative initial state.
    let initialResolved = false;

    void ensureSession().then(async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setSession(data.session);
      initialResolved = true;
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      logger.info("auth state changed", { event });
      if (!mounted) return;
      if (!initialResolved && event === "INITIAL_SESSION") return;
      setSession(session);
    });

    // Browsers throttle background-tab timers, so the auto-refresh loop can
    // miss an expiry while the tab is backgrounded. When the tab becomes
    // visible again — or the network comes back — we proactively re-check
    // the session, which forces supabase-js to refresh the access token if
    // it's expired. Without this, the user sees a momentary "logged out"
    // state on tab switch.
    const refreshIfNeeded = (): void => {
      void supabase.auth.getSession().then(({ data }) => {
        if (mounted) setSession(data.session);
      });
    };
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") refreshIfNeeded();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refreshIfNeeded);
    window.addEventListener("online", refreshIfNeeded);

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refreshIfNeeded);
      window.removeEventListener("online", refreshIfNeeded);
      setLoading(false);
    };
  }, [setSession, setLoading]);
}
