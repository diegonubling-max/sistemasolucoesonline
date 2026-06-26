/**
 * Global handler for Supabase JWT expiration.
 *
 * Intercepts window.fetch to detect 401 responses with "JWT expired" (or PGRST301)
 * coming from Supabase, calls supabase.auth.refreshSession(), and transparently
 * retries the original request once with the new token. If the refresh fails,
 * signs the user out and redirects to /login with a friendly message.
 */
import { supabase } from "@/integrations/supabase/client";

let installed = false;
let refreshing: Promise<string | null> | null = null;

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";

function isSupabaseUrl(input: RequestInfo | URL): boolean {
  try {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    return !!SUPABASE_URL && url.startsWith(SUPABASE_URL);
  } catch {
    return false;
  }
}

async function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) return null;
        return data.session.access_token;
      } catch {
        return null;
      } finally {
        // Reset on next tick so concurrent callers share this attempt only
        setTimeout(() => {
          refreshing = null;
        }, 0);
      }
    })();
  }
  return refreshing;
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  const isAluno = path.startsWith("/aluno");
  const target = isAluno ? "/aluno/login" : "/login";
  // Avoid bouncing if we're already on a login page
  if (path === target) return;
  try {
    sessionStorage.setItem(
      "session_expired_message",
      "Sua sessão expirou. Faça login novamente.",
    );
  } catch {
    // ignore
  }
  window.location.assign(target);
}

async function isJwtExpiredResponse(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  try {
    const clone = res.clone();
    const text = await clone.text();
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
      lower.includes("jwt expired") ||
      lower.includes("pgrst301") ||
      lower.includes("token is expired")
    );
  } catch {
    return false;
  }
}

export function installSupabaseJwtHandler() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);

    if (!isSupabaseUrl(input)) return response;
    if (!(await isJwtExpiredResponse(response))) return response;

    const newToken = await refreshOnce();
    if (!newToken) {
      // Refresh failed → sign out and bounce to login
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
      redirectToLogin();
      return response;
    }

    // Retry the original request with the new bearer token
    const retryInit: RequestInit = { ...(init ?? {}) };
    const headers = new Headers(retryInit.headers ?? (input as Request).headers);
    headers.set("Authorization", `Bearer ${newToken}`);
    // apikey header stays as-is (publishable key)
    retryInit.headers = headers;

    return originalFetch(input, retryInit);
  };

  // Also react to background SIGNED_OUT events (e.g. refresh failed internally)
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      // No-op; redirect happens via the explicit handler above when needed.
    }
  });
}
