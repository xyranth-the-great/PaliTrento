// Native (Android app) integration via Capacitor.
// On the regular website every helper here falls back to normal browser behavior.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './supabase.js';
// Note: intentionally not importing auth.js/ui.js here (ui.js imports this file; avoid import cycles).

function getWebOAuthRedirectUrl() {
  const redirectUrl = new URL('/', window.location.href);
  redirectUrl.searchParams.set('auth_callback', '1');
  return redirectUrl.href;
}

export const isNativeApp = Capacitor.isNativePlatform();

// Must match the intent-filter scheme in android/app/src/main/AndroidManifest.xml
// and be listed in Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs.
export const NATIVE_AUTH_REDIRECT = 'com.palitrento.app://auth-callback';

/**
 * Start Google sign-in.
 * Google blocks OAuth inside app WebViews, so in the app we open the system browser
 * and come back through the com.palitrento.app:// deep link.
 */
export async function startGoogleOAuth() {
  if (!isNativeApp) {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getWebOAuthRedirectUrl() },
    });
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return { data, error: error || new Error('No OAuth URL returned') };
  await Browser.open({ url: data.url });
  return { data, error: null };
}

async function handleAuthDeepLink(url) {
  if (!url || !url.startsWith(NATIVE_AUTH_REDIRECT)) return;
  try { await Browser.close(); } catch { /* not supported on every platform */ }
  if (!supabase) return;

  const parsed = new URL(url);
  const query = parsed.searchParams;
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const errorDescription = query.get('error_description') || hash.get('error_description');

  try {
    if (errorDescription) throw new Error(errorDescription);

    const code = query.get('code');
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw error;
    } else {
      throw new Error('Sign-in was cancelled or returned no session.');
    }
    // Reuse the website's existing post-OAuth flow (role choice, dashboard redirect, ...)
    window.location.replace('/?auth_callback=1');
  } catch (err) {
    console.error('[native] OAuth deep link failed:', err);
    const target = new URL('/login/', window.location.origin);
    target.searchParams.set('error_description', err?.message || 'Google sign-in failed');
    window.location.replace(target.href);
  }
}

if (isNativeApp) {
  document.documentElement.classList.add('native-app');

  App.addListener('appUrlOpen', ({ url }) => { handleAuthDeepLink(url); });

  // Android hardware back button: go back in page history, exit on the first page.
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else App.exitApp();
  });
}
