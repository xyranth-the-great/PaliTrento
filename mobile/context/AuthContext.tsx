import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../lib/data';
import { ONBOARDING_KEY } from '../lib/constants';
import {
  completeGoogleRegistration,
  getRestriction,
  GOOGLE_ROLE_PENDING_KEY,
  isExpiredSuspension,
  isNewGoogleAccount,
  isRestrictedAuthError,
  Restriction,
  restoreExpiredSuspensions,
} from '../lib/account';

WebBrowser.maybeCompleteAuthSession();

const PROFILE_COLUMNS =
  'account_status, suspended_until, suspension_reason, banned_at, ban_reason, role, full_name, barangay, avatar_url, email';

export interface PremiumDetails {
  is_premium?: boolean;
  status?: string | null;
  current_period_end?: string | null;
  grace_period_ends_at?: string | null;
  plan_code?: string | null;
  [key: string]: any;
}

export interface AuthUserProfile extends UserProfile {
  is_premium?: boolean;
  premium_details?: PremiumDetails | null;
}

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  barangay: string;
  role: 'customer' | 'business_owner';
}

interface AuthContextValue {
  session: Session | null;
  profile: AuthUserProfile | null;
  loading: boolean;
  onboarded: boolean;
  restriction: Restriction | null;
  needsRoleChoice: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null; restricted?: boolean }>;
  signUpWithEmail: (input: SignUpInput) => Promise<{ error: string | null; alreadyExists?: boolean }>;
  signInWithGoogle: () => Promise<{ error: string | null; restricted?: boolean }>;
  handleOAuthCallbackUrl: (url: string) => Promise<{ error: string | null; restricted?: boolean }>;
  completeGoogleRole: (role: 'customer' | 'business_owner') => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getGoogleRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return Linking.createURL('auth-callback');
  }
  return 'palitrento://auth-callback';
}

function parseOAuthCallbackParams(rawUrl: string) {
  let queryStr = '';
  let hashStr = '';
  try {
    const parsed = new URL(rawUrl);
    queryStr = parsed.search.replace(/^\?/, '');
    hashStr = parsed.hash.replace(/^#/, '');
  } catch {
    const [beforeHash, afterHash = ''] = rawUrl.split('#');
    const qIdx = beforeHash.indexOf('?');
    queryStr = qIdx >= 0 ? beforeHash.slice(qIdx + 1) : '';
    hashStr = afterHash;
  }

  const query = new URLSearchParams(queryStr);
  const hash = new URLSearchParams(hashStr);
  const code = query.get('code') || hash.get('code');
  const accessToken = hash.get('access_token') || query.get('access_token');
  const refreshToken = hash.get('refresh_token') || query.get('refresh_token');
  const errorDescription =
    query.get('error_description') ||
    hash.get('error_description') ||
    query.get('error') ||
    hash.get('error');

  return { code, accessToken, refreshToken, errorDescription };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [needsRoleChoice, setNeedsRoleChoice] = useState(false);
  const handledOAuthKeyRef = useRef<string | null>(null);
  const inFlightOAuthRef = useRef<Promise<{ error: string | null; restricted?: boolean }> | null>(
    null
  );

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const fetchProfile = async () =>
        (await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle()).data;
      let data = await fetchProfile();
      // Same as the website: lift suspensions that have already expired, then reload.
      if (isExpiredSuspension(data)) {
        await restoreExpiredSuspensions();
        data = await fetchProfile();
      }
      if (!data) {
        setProfile(null);
        return;
      }

      let isPremium = false;
      let premiumDetails: PremiumDetails | null = null;
      if (data.role === 'business_owner') {
        try {
          const { data: subData, error: subError } = await supabase.rpc(
            'get_subscription_dashboard_data',
            { p_user_id: userId }
          );
          if (!subError && subData?.subscription) {
            premiumDetails = subData.subscription as PremiumDetails;
            isPremium =
              premiumDetails?.is_premium === true && premiumDetails?.status === 'ACTIVE';
          }
        } catch {
          // Keep profile working with is_premium false and premium_details null
        }
      }

      setProfile({
        ...data,
        is_premium: isPremium,
        premium_details: premiumDetails,
      });
    } catch {
      setProfile(null);
    }
  }, []);

  const checkRoleChoice = useCallback(async (sess: Session | null) => {
    if (!sess?.user) {
      setNeedsRoleChoice(false);
      return;
    }
    const flag = await AsyncStorage.getItem(GOOGLE_ROLE_PENDING_KEY);
    setNeedsRoleChoice(flag === sess.user.id);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [flag, sessRes] = await Promise.all([AsyncStorage.getItem(ONBOARDING_KEY), supabase.auth.getSession()]);
        if (!active) return;
        setOnboarded(flag === '1');
        const sess = sessRes.data.session ?? null;
        setSession(sess);
        if (sess?.user?.id) await loadProfile(sess.user.id);
        await checkRoleChoice(sess);
      } finally {
        if (active) setLoading(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user?.id) loadProfile(nextSession.user.id);
      else setProfile(null);
      checkRoleChoice(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [checkRoleChoice, loadProfile]);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    setOnboarded(true);
  }, []);

  const resetOnboarding = useCallback(async () => {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    setOnboarded(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await loadProfile(session.user.id);
  }, [session?.user?.id, loadProfile]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        return { error: error.message, restricted: isRestrictedAuthError(error.message) };
      }
      if (data.user?.id) await loadProfile(data.user.id);
      return { error: null };
    },
    [loadProfile]
  );

  // Called only AFTER the email code is verified (same order as the website's verify.js)
  const signUpWithEmail = useCallback(async (input: SignUpInput) => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: { data: { full_name: input.fullName.trim(), barangay: input.barangay || null, role: input.role } },
    });
    if (error) return { error: error.message };
    const identities = data.user?.identities;
    if (!data.user || !identities || identities.length === 0) {
      return { error: 'An account with this email already exists. Please log in or reset your password.', alreadyExists: true };
    }
    return { error: null };
  }, []);

  const handleOAuthCallbackUrl = useCallback(
    async (rawUrl: string): Promise<{ error: string | null; restricted?: boolean }> => {
      if (!rawUrl) return { error: null };
      const { code, accessToken, refreshToken, errorDescription } = parseOAuthCallbackParams(rawUrl);

      if (errorDescription) {
        return {
          error: errorDescription,
          restricted: isRestrictedAuthError(errorDescription),
        };
      }

      if (!code && !(accessToken && refreshToken)) {
        return { error: null };
      }

      const dedupeKey = code || accessToken!.slice(0, 32);
      if (handledOAuthKeyRef.current === dedupeKey) {
        return { error: null };
      }
      if (inFlightOAuthRef.current) {
        return await inFlightOAuthRef.current;
      }

      const work = (async (): Promise<{ error: string | null; restricted?: boolean }> => {
        try {
          let user: any = null;
          if (code) {
            const { data: ex, error: exErr } = await supabase.auth.exchangeCodeForSession(code);
            if (exErr) {
              return { error: exErr.message, restricted: isRestrictedAuthError(exErr.message) };
            }
            user = ex.user;
          } else if (accessToken && refreshToken) {
            const { data: setRes, error: setErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (setErr) {
              return { error: setErr.message, restricted: isRestrictedAuthError(setErr.message) };
            }
            user = setRes.user;
          }

          handledOAuthKeyRef.current = dedupeKey;

          if (user?.id) {
            await loadProfile(user.id);
          }

          if (user && isNewGoogleAccount(user)) {
            await AsyncStorage.setItem(GOOGLE_ROLE_PENDING_KEY, user.id);
            setNeedsRoleChoice(true);
          }

          return { error: null };
        } catch (e: any) {
          const msg = e?.message || 'Google sign-in failed.';
          return { error: msg, restricted: isRestrictedAuthError(msg) };
        } finally {
          inFlightOAuthRef.current = null;
        }
      })();

      inFlightOAuthRef.current = work;
      return await work;
    },
    [loadProfile]
  );

  // Catch OAuth redirects delivered via Android deep link intent (even if WebBrowser returns dismiss)
  useEffect(() => {
    const onUrl = ({ url }: { url: string }) => {
      if (url && (url.includes('auth-callback') || url.includes('code=') || url.includes('access_token='))) {
        void handleOAuthCallbackUrl(url);
      }
    };

    const sub = Linking.addEventListener('url', onUrl);
    Linking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl) onUrl({ url: initialUrl });
      })
      .catch(() => {});

    return () => {
      sub.remove();
    };
  }, [handleOAuthCallbackUrl]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const redirectTo = getGoogleRedirectUrl();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error || !data?.url) return { error: error?.message || 'Could not start Google login.' };

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
        showInRecents: true,
      });

      if (res.type === 'success' && res.url) {
        return await handleOAuthCallbackUrl(res.url);
      }

      // On some Android devices/browsers, the redirect arrives via Linking deep link while openAuthSessionAsync returns dismiss
      if (inFlightOAuthRef.current) {
        return await inFlightOAuthRef.current;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (inFlightOAuthRef.current) {
        return await inFlightOAuthRef.current;
      }
      return { error: null };
    } catch (e: any) {
      const msg = e?.message || 'Google sign-in failed.';
      return { error: msg, restricted: isRestrictedAuthError(msg) };
    }
  }, [handleOAuthCallbackUrl]);

  const completeGoogleRole = useCallback(
    async (role: 'customer' | 'business_owner') => {
      try {
        await completeGoogleRegistration(role);
        await AsyncStorage.removeItem(GOOGLE_ROLE_PENDING_KEY);
        setNeedsRoleChoice(false);
        if (session?.user?.id) await loadProfile(session.user.id);
        return { error: null };
      } catch (e: any) {
        return { error: e?.message || 'Could not save your account type.' };
      }
    },
    [loadProfile, session?.user?.id]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem(GOOGLE_ROLE_PENDING_KEY);
    setSession(null);
    setProfile(null);
    setNeedsRoleChoice(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        onboarded,
        restriction: getRestriction(profile),
        needsRoleChoice,
        completeOnboarding,
        resetOnboarding,
        refreshProfile,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        handleOAuthCallbackUrl,
        completeGoogleRole,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
