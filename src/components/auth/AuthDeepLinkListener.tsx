import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { isAccountSuspendedFailure } from '../../lib/authFailure';
import { isAccountSuspendedError } from '../../lib/apiClient';
import { handleAuthDeepLink } from '../../lib/authDeepLink';
import { endCallbackSessionCommit } from '../../lib/authCallbackTransaction';
import { loadRecoveryState } from '../../lib/recoveryState';
import { useAuth } from '../../context/AuthContext';
import { resolvePostAuthDestination } from '../../lib/postAuthGate';
import { applyPostAuthDestination } from '../../lib/postAuthNavigation';
import { consumeProcessStart, hasConsumedProcessStart } from '../../lib/processStart';
import { enterSignedOutAt } from '../../lib/productTree';
import type { RootStackParamList } from '../../navigation/types';

/**
 * Listens for Supabase auth redirects (legacy confirmation links / recovery / OAuth).
 * Primary signup UX is email OTP on ConfirmCode — deep links must still pass the
 * same post-auth gate and cannot bypass email verification or Nest hydrate.
 *
 * Initial URL is processed once; live `url` events still work. Auth/session
 * dependency updates must not re-run getInitialURL side effects.
 */
export default function AuthDeepLinkListener() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    refreshMe,
    bootstrapSession,
    apiUser,
    session,
    signUpBasics,
    accountSuspended,
    mediaCacheReady,
    mediaCacheBlocked,
  } = useAuth();
  const handling = useRef(false);
  const initialUrlHandled = useRef(false);
  const apiUserRef = useRef(apiUser);
  const sessionRef = useRef(session);
  const signUpBasicsRef = useRef(signUpBasics);
  const refreshMeRef = useRef(refreshMe);
  const bootstrapSessionRef = useRef(bootstrapSession);
  const navigationRef = useRef(navigation);
  const accountSuspendedRef = useRef(accountSuspended);
  const mediaCacheReadyRef = useRef(mediaCacheReady);
  const mediaCacheBlockedRef = useRef(mediaCacheBlocked);

  apiUserRef.current = apiUser;
  sessionRef.current = session;
  signUpBasicsRef.current = signUpBasics;
  refreshMeRef.current = refreshMe;
  bootstrapSessionRef.current = bootstrapSession;
  navigationRef.current = navigation;
  accountSuspendedRef.current = accountSuspended;
  mediaCacheReadyRef.current = mediaCacheReady;
  mediaCacheBlockedRef.current = mediaCacheBlocked;

  useEffect(() => {
    const run = async (url: string | null) => {
      if (!url || handling.current) return;
      if (loadRecoveryState()) return;
      if (accountSuspendedRef.current) return;
      handling.current = true;
      try {
        const result = await handleAuthDeepLink(url);
        if (result.type === 'recovery-rejected') {
          Alert.alert(
            'Use the reset code',
            'This password reset link cannot sign you in. Enter the code from the email on the Forgot Password screen.',
            [
              {
                text: 'OK',
                onPress: () => {
                  if (apiUserRef.current) return;
                  if (!hasConsumedProcessStart()) {
                    enterSignedOutAt({ name: 'ForgotPassword' });
                    return;
                  }
                  navigationRef.current.navigate('ForgotPassword');
                },
              },
            ],
          );
          return;
        }
        if (result.type === 'link-rejected') {
          Alert.alert(
            'Link not used',
            'This link cannot sign you in. Continue in the app, or enter the code from your email.',
          );
          return;
        }
        if (result.type === 'stale-callback-session') {
          // The queued callback already removed only the session it wrote.
          // A session that is still stored belongs to a later operation.
          endCallbackSessionCommit();
          Alert.alert(
            'Link not used',
            'This link cannot sign you in. Continue in the app, or enter the code from your email.',
          );
          return;
        }
        if (result.type === 'error') {
          Alert.alert('Verification failed', result.message, [
            {
              text: 'OK',
              onPress: () => {
                if (!hasConsumedProcessStart()) {
                  enterSignedOutAt({ name: 'SignIn' });
                  return;
                }
                navigationRef.current.navigate('SignIn');
              },
            },
          ]);
          return;
        }
        if (result.type === 'session') {
          if (loadRecoveryState()) return;
          try {
            const user = apiUserRef.current
              ? await refreshMeRef.current()
              : await bootstrapSessionRef.current();
            const dest = resolvePostAuthDestination({
              flow: 'deeplink',
              apiUser: user,
              session: sessionRef.current,
              signUpBasics: signUpBasicsRef.current,
            });
            const deadline = Date.now() + 30000;
            while (Date.now() < deadline && !mediaCacheBlockedRef.current) {
              if (
                mediaCacheReadyRef.current &&
                apiUserRef.current?.id === user.id
              ) {
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
            if (
              !mediaCacheReadyRef.current ||
              apiUserRef.current?.id !== user.id
            ) {
              return;
            }
            consumeProcessStart();
            applyPostAuthDestination(navigationRef.current, dest);
          } catch (e) {
            if (isAccountSuspendedError(e) || isAccountSuspendedFailure(e)) {
              return;
            }
            Alert.alert(
              'Signed in, but profile failed',
              e instanceof Error
                ? e.message
                : 'Could not load your Mawahib profile. Your session is kept — retry when the backend is available.',
            );
            navigationRef.current.navigate('SignIn');
          }
        }
      } finally {
        handling.current = false;
      }
    };

    if (!initialUrlHandled.current) {
      initialUrlHandled.current = true;
      void Linking.getInitialURL().then((url) => run(url));
    }

    const sub = Linking.addEventListener('url', ({ url }) => {
      void run(url);
    });
    return () => sub.remove();
  }, []);

  return null;
}
