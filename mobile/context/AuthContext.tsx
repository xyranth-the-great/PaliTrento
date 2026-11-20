import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../lib/data';
import { ONBOARDING_KEY } from '../lib/constants';
import { presentLocalPushNotification, unregisterDevicePushToken } from '../lib/push';
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

export interface OAuthResult {
  error: string | null;
  restricted?: boolean;
  signedIn?: boolean;
  needsRoleChoice?: boolean;
}

export interface OAuthCallbackParams {
  code?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  errorDescription?: string | null;
}

interface AuthContextValue {
  session: Session | null;
  profile: AuthUserProfile | null;
  loading: boolean;
  onboarded: boolean;
  restriction: Restriction | null;
  restrictedEmail: string | null;
  clearRestriction: () => void;
  oauthError: string | null;
  clearOAuthError: () => void;
  needsRoleChoice: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null; restricted?: boolean }>;
  signUpWithEmail: (input: SignUpInput) => Promise<{ error: string | null; alreadyExists?: boolean }>;
  signInWithGoogle: () => Promise<OAuthResult>;
  handleOAuthCallbackUrl: (url: string) => Promise<OAuthResult>;
  handleOAuthParams: (params: OAuthCallbackParams) => Promise<OAuthResult>;
  completeGoogleRole: (role: 'customer' | 'business_owner') => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getGoogleRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return Linking.createURL('auth/callback');
  }
  return 'palitrento://auth/callback';
}

function parseParamBlock(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const part of raw.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const k = eq >= 0 ? part.slice(0, eq) : part;
    const v = eq >= 0 ? part.slice(eq + 1) : '';
    try {
      const key = decodeURIComponent(k.replace(/\+/g, ' '));
      const val = decodeURIComponent(v.replace(/\+/g, ' '));
      if (key) out[key] = val;
    } catch {
      if (k) out[k] = v;
    }
  }
  return out;
}

function parseOAuthCallbackParams(rawUrl: string): OAuthCallbackParams {
  if (!rawUrl) return {};
  const hashIdx = rawUrl.indexOf('#');
  const beforeHash = hashIdx >= 0 ? rawUrl.slice(0, hashIdx) : rawUrl;
  const hashStr = hashIdx >= 0 ? rawUrl.slice(hashIdx + 1) : '';
  const qIdx = beforeHash.indexOf('?');
  const queryStr = qIdx >= 0 ? beforeHash.slice(qIdx + 1) : '';

  const query = parseParamBlock(queryStr);
  const hash = parseParamBlock(hashStr);
  const code = query.code || hash.code || null;
  const accessToken = hash.access_token || query.access_token || null;
  const refreshToken = hash.refresh_token || query.refresh_token || null;
  const errorDescription =
    query.error_description ||
    hash.error_description ||
    query.error ||
    hash.error ||
    null;

  return { code, accessToken, refreshToken, errorDescription };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [needsRoleChoice, setNeedsRoleChoice] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [forcedRestriction, setForcedRestriction] = useState<{
    restriction: Restriction;
    email: string | null;
  } | null>(null);
  const enforcingRestrictionRef = useRef(false);
  const handledOAuthKeysRef = useRef<Set<string>>(new Set());
  const pendingFlowIdRef = useRef<string | null>(null);
  const oauthErrorRef = useRef<string | null>(null);
  const inFlightOAuthRef = useRef<Promise<OAuthResult> | null>(null);

  const clearRestriction = useCallback(() => {
    setForcedRestriction(null);
  }, []);

  const clearOAuthError = useCallback(() => {
    oauthErrorRef.current = null;
    setOauthError(null);
  }, []);

  const enforceRestrictionIfNeeded = useCallback(
    async (
      profileRow: Record<string, any> | null | undefined,
      userId: string,
      fallbackEmail?: string | null
    ): Promise<boolean> => {
      const found = getRestriction(profileRow);
      if (!found) return false;
      if (enforcingRestrictionRef.current) return true;
      enforcingRestrictionRef.current = true;

      const targetEmail = profileRow?.email || fallbackEmail || null;
      setForcedRestriction({ restriction: found, email: targetEmail });

      const title = found.kind === 'banned' ? 'Account Banned' : 'Account Suspended';
      const body =
        found.reason ||
        (found.kind === 'banned'
          ? 'Your PaliTrento account has been banned by an administrator.'
          : 'Your PaliTrento account has been suspended by an administrator.');

      presentLocalPushNotification({
        title,
        body,
        channelId: 'moderation',
        data: { pathname: '/auth-status' },
      }).catch(() => {});

      try {
        await unregisterDevicePushToken(userId);
      } catch {}
      try {
        await supabase.auth.signOut();
      } catch {}
      try {
        await AsyncStorage.removeItem(GOOGLE_ROLE_PENDING_KEY);
      } catch {}

      setSession(null);
      setProfile(null);
      setNeedsRoleChoice(false);
      enforcingRestrictionRef.current = false;
      return true;
    },
    []
  );

  const loadProfile = useCallback(
    async (userId: string, fallbackEmail?: string | null): Promise<boolean> => {
      try {
        const fetchProfile = async () =>
          (await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle())
            .data;
        let data = await fetchProfile();
        // Same as the website: lift suspensions that have already expired, then reload.
        if (isExpiredSuspension(data)) {
          await restoreExpiredSuspensions();
          data = await fetchProfile();
        }
        if (!data) {
          setProfile(null);
          return false;
        }

        // Immediately sign out banned/suspended accounts and show /auth-status
        if (await enforceRestrictionIfNeeded(data, userId, fallbackEmail)) {
          return true;
        }

        setForcedRestriction(null);

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
        return false;
      } catch {
        setProfile(null);
        return false;
      }
    },
    [enforceRestrictionIfNeeded]
  );

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
        if (sess?.user?.id) await loadProfile(sess.user.id, sess.user.email);
        await checkRoleChoice(sess);
      } finally {
        if (active) setLoading(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user?.id) loadProfile(nextSession.user.id, nextSession.user.email);
      else setProfile(null);
      checkRoleChoice(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [checkRoleChoice, loadProfile]);

  // Real-time + foreground ban/suspension enforcement: immediately signs out restricted users
  useEffect(() => {
    const uid = session?.user?.id;
    const email = session?.user?.email ?? null;
    if (!uid) return;

    let cancelled = false;

    const checkAccountStatusNow = async () => {
      if (cancelled || enforcingRestrictionRef.current) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('account_status, suspended_until, suspension_reason, banned_at, ban_reason, email')
          .eq('id', uid)
          .maybeSingle();
        if (cancelled || !data) return;
        if (isExpiredSuspension(data)) {
          await restoreExpiredSuspensions();
          return;
        }
        await enforceRestrictionIfNeeded(data, uid, email);
      } catch {
        // Ignore transient offline errors
      }
    };

    const profileCh = supabase
      .channel(`rn-auth-restriction-${uid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
        async (payload) => {
          if (cancelled) return;
          const nextRow = payload.new as Record<string, any> | undefined;
          if (!nextRow) return;
          if (isExpiredSuspension(nextRow)) return;
          await enforceRestrictionIfNeeded(nextRow, uid, email);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'account_moderation_actions',
          filter: `target_user_id=eq.${uid}`,
        },
        async (payload) => {
          if (cancelled) return;
          const act = String((payload.new as any)?.action || '');
          if (act === 'ban' || act === 'suspend_temporary' || act === 'suspend_permanent') {
            await checkAccountStatusNow();
          }
        }
      )
      .subscribe();

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkAccountStatusNow();
      }
    });

    // Lightweight 20s safety poll while active in case Realtime WebSocket drops
    const pollTimer = setInterval(() => {
      if (AppState.currentState === 'active') {
        void checkAccountStatusNow();
      }
    }, 20_000);

    return () => {
      cancelled = true;
      supabase.removeChannel(profileCh);
      appSub.remove();
      clearInterval(pollTimer);
    };
  }, [enforceRestrictionIfNeeded, session?.user?.email, session?.user?.id]);

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
      const cleanEmail = email.trim().toLowerCase();
      setForcedRestriction(null);
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        const restricted = isRestrictedAuthError(error.message);
        return { error: error.message, restricted };
      }
      if (data.user?.id) {
        const wasRestricted = await loadProfile(data.user.id, data.user.email ?? cleanEmail);
        if (wasRestricted) {
          return { error: 'Account is restricted.', restricted: true };
        }
      }
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

  const handleOAuthParams = useCallback(
    async (params: OAuthCallbackParams): Promise<OAuthResult> => {
      const code = params.code?.trim() || null;
      const accessToken = params.accessToken?.trim() || null;
      const refreshToken = params.refreshToken?.trim() || null;
      const errorDescription = params.errorDescription?.trim() || null;

      if (errorDescription) {
        console.warn('[OAuth] provider error:', errorDescription);
        const restricted = isRestrictedAuthError(errorDescription);
        if (!restricted) {
          oauthErrorRef.current = errorDescription;
          setOauthError(errorDescription);
        }
        return { error: errorDescription, restricted };
      }

      if (!code && !(accessToken && refreshToken)) {
        return { error: null };
      }

      const dedupeKey = code || accessToken!.slice(0, 32);
      if (handledOAuthKeysRef.current.has(dedupeKey)) {
        return { error: null, signedIn: true };
      }
      if (inFlightOAuthRef.current) {
        return await inFlightOAuthRef.current;
      }

      const work = (async (): Promise<OAuthResult> => {
        try {
          let nextSession: Session | null = null;
          let user: any = null;

          if (code) {
            const flowId = pendingFlowIdRef.current;
            console.log('[OAuth] exchanging PKCE code (hasFlowId=' + Boolean(flowId) + ')');
            let exRes = await supabase.auth.exchangeCodeForSession(
              code,
              flowId ? { flowId } : undefined
            );
            if (exRes.error && flowId) {
              console.warn('[OAuth] flowId exchange failed, retrying default verifier:', exRes.error.message);
              exRes = await supabase.auth.exchangeCodeForSession(code);
            }
            if (exRes.error) {
              console.warn('[OAuth] exchangeCodeForSession failed:', exRes.error.message);
              const restricted = isRestrictedAuthError(exRes.error.message);
              if (!restricted) {
                oauthErrorRef.current = exRes.error.message;
                setOauthError(exRes.error.message);
              }
              return { error: exRes.error.message, restricted };
            }
            nextSession = exRes.data.session ?? null;
            user = exRes.data.user ?? nextSession?.user ?? null;
          } else if (accessToken && refreshToken) {
            console.log('[OAuth] setting session from callback tokens');
            const { data: setRes, error: setErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (setErr) {
              console.warn('[OAuth] setSession failed:', setErr.message);
              const restricted = isRestrictedAuthError(setErr.message);
              if (!restricted) {
                oauthErrorRef.current = setErr.message;
                setOauthError(setErr.message);
              }
              return { error: setErr.message, restricted };
            }
            nextSession = setRes.session ?? null;
            user = setRes.user ?? nextSession?.user ?? null;
          }

          handledOAuthKeysRef.current.add(dedupeKey);
          pendingFlowIdRef.current = null;
          oauthErrorRef.current = null;
          setOauthError(null);

          if (!nextSession) {
            const { data: sessData } = await supabase.auth.getSession();
            nextSession = sessData.session ?? null;
            if (!user) user = nextSession?.user ?? null;
          }

          if (nextSession) {
            setSession(nextSession);
          }

          if (user?.id) {
            const wasRestricted = await loadProfile(user.id, user.email);
            if (wasRestricted) {
              return { error: 'Account is restricted.', restricted: true };
            }
          }

          let isNew = false;
          if (user && isNewGoogleAccount(user)) {
            isNew = true;
            await AsyncStorage.setItem(GOOGLE_ROLE_PENDING_KEY, user.id);
            setNeedsRoleChoice(true);
          }

          console.log('[OAuth] sign-in complete (hasSession=' + Boolean(nextSession) + ', isNew=' + isNew + ')');
          return { error: null, signedIn: Boolean(nextSession || user), needsRoleChoice: isNew };
        } catch (e: any) {
          const msg = e?.message || 'Google sign-in failed.';
          console.warn('[OAuth] unexpected callback exception:', msg);
          const restricted = isRestrictedAuthError(msg);
          if (!restricted) {
            oauthErrorRef.current = msg;
            setOauthError(msg);
          }
          return { error: msg, restricted };
        } finally {
          inFlightOAuthRef.current = null;
        }
      })();

      inFlightOAuthRef.current = work;
      return await work;
    },
    [loadProfile]
  );

  const handleOAuthCallbackUrl = useCallback(
    async (rawUrl: string): Promise<OAuthResult> => {
      if (!rawUrl) return { error: null };
      const parsed = parseOAuthCallbackParams(rawUrl);
      console.log(
        '[OAuth] callback URL received (hasCode=' +
          Boolean(parsed.code) +
          ', hasToken=' +
          Boolean(parsed.accessToken) +
          ', hasError=' +
          Boolean(parsed.errorDescription) +
          ')'
      );
      return await handleOAuthParams(parsed);
    },
    [handleOAuthParams]
  );

  // Catch OAuth redirects delivered via Android deep link intent (even if WebBrowser returns dismiss)
  useEffect(() => {
    const onUrl = ({ url }: { url: string }) => {
      if (
        url &&
        (url.includes('auth/callback') ||
          url.includes('auth-callback') ||
          url.includes('code=') ||
          url.includes('access_token=') ||
          url.includes('error='))
      ) {
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

  const signInWithGoogle = useCallback(async (): Promise<OAuthResult> => {
    try {
      oauthErrorRef.current = null;
      setOauthError(null);
      const preLoginInitialUrl = await Linking.getInitialURL().catch(() => null);

      const redirectTo = getGoogleRedirectUrl();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error || !data?.url) {
        const msg = error?.message || 'Could not start Google login.';
        oauthErrorRef.current = msg;
        setOauthError(msg);
        return { error: msg };
      }

      pendingFlowIdRef.current = (data as any)?.flowId ?? null;
      console.log('[OAuth] opening auth session -> ' + redirectTo);

      const res = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
        Platform.OS === 'android'
          ? { createTask: false, useProxyActivity: false, showTitle: true }
          : { showInRecents: true }
      );
      console.log(
        '[OAuth] openAuthSessionAsync returned type=' +
          res.type +
          ' hasUrl=' +
          Boolean(res.type === 'success' && res.url)
      );

      if (res.type === 'success' && res.url) {
        return await handleOAuthCallbackUrl(res.url);
      }

      // On Android, Chrome Custom Tabs may deliver the deep link slightly after AppState becomes active
      for (let i = 0; i < 10; i++) {
        if (inFlightOAuthRef.current) {
          return await inFlightOAuthRef.current;
        }
        const latestIntentUrl = await Linking.getInitialURL().catch(() => null);
        if (
          latestIntentUrl &&
          latestIntentUrl !== preLoginInitialUrl &&
          (latestIntentUrl.includes('code=') ||
            latestIntentUrl.includes('access_token=') ||
            latestIntentUrl.includes('error='))
        ) {
          const parsed = parseOAuthCallbackParams(latestIntentUrl);
          const key = parsed.code || parsed.accessToken?.slice(0, 32) || null;
          if ((key && !handledOAuthKeysRef.current.has(key)) || parsed.errorDescription) {
            return await handleOAuthCallbackUrl(latestIntentUrl);
          }
        }
        const { data: sessData } = await supabase.auth.getSession();
        if (sessData.session) {
          setSession(sessData.session);
          return { error: null, signedIn: true };
        }
        if (oauthErrorRef.current) {
          return {
            error: oauthErrorRef.current,
            restricted: isRestrictedAuthError(oauthErrorRef.current),
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 120));
      }

      return { error: oauthErrorRef.current };
    } catch (e: any) {
      const msg = e?.message || 'Google sign-in failed.';
      console.warn('[OAuth] signInWithGoogle exception:', msg);
      const restricted = isRestrictedAuthError(msg);
      if (!restricted) {
        oauthErrorRef.current = msg;
        setOauthError(msg);
      }
      return { error: msg, restricted };
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
    const uid = session?.user?.id;
    if (uid) {
      unregisterDevicePushToken(uid).catch(() => {});
    }
    await supabase.auth.signOut();
    await AsyncStorage.removeItem(GOOGLE_ROLE_PENDING_KEY);
    setSession(null);
    setProfile(null);
    setNeedsRoleChoice(false);
  }, [session?.user?.id]);

  const restriction = useMemo(
    () => forcedRestriction?.restriction ?? getRestriction(profile),
    [forcedRestriction, profile]
  );
  const restrictedEmail = forcedRestriction?.email ?? profile?.email ?? session?.user?.email ?? null;

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      onboarded,
      restriction,
      restrictedEmail,
      clearRestriction,
      oauthError,
      clearOAuthError,
      needsRoleChoice,
      completeOnboarding,
      resetOnboarding,
      refreshProfile,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      handleOAuthCallbackUrl,
      handleOAuthParams,
      completeGoogleRole,
      signOut,
    }),
    [
      session,
      profile,
      loading,
      onboarded,
      restriction,
      restrictedEmail,
      clearRestriction,
      oauthError,
      clearOAuthError,
      needsRoleChoice,
      completeOnboarding,
      resetOnboarding,
      refreshProfile,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      handleOAuthCallbackUrl,
      handleOAuthParams,
      completeGoogleRole,
      signOut,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
