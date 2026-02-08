export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Check if we're in development mode (use local dev auth)
 */
export const isDevMode = (): boolean => {
  // Always use dev mode on localhost
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  // Dev mode if VITE_OAUTH_PORTAL_URL is not set or empty
  return !oauthPortalUrl || oauthPortalUrl.trim() === "";
};

/**
 * Generate login URL at runtime so redirect URI reflects the current origin.
 * In development mode (no VITE_OAUTH_PORTAL_URL), redirects to local dev login.
 */
export const getLoginUrl = (returnPath?: string): string => {
  // Development mode - use local dev auth
  if (isDevMode()) {
    const devLoginUrl = `${window.location.origin}/dev/login`;
    return returnPath ? `${devLoginUrl}?returnPath=${encodeURIComponent(returnPath)}` : devLoginUrl;
  }

  // Production mode - use external OAuth
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  // Include returnPath in state if provided
  const stateData = returnPath
    ? JSON.stringify({ redirectUri, returnPath })
    : redirectUri;
  const state = btoa(stateData);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

/**
 * Get logout URL
 */
export const getLogoutUrl = (): string => {
  if (isDevMode()) {
    return `${window.location.origin}/dev/logout`;
  }
  return `${window.location.origin}/api/auth/logout`;
};
