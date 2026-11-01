import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

function mountedNavigatorHas(name: 'SignIn' | 'Welcome'): boolean {
  if (!navigationRef.isReady()) return false;
  const routeNames = navigationRef.getRootState()?.routeNames;
  return Array.isArray(routeNames) && routeNames.includes(name);
}

export function navigateSignedOut(
  name: 'SignIn' | 'Welcome',
  params?: RootStackParamList['SignIn'] | RootStackParamList['Welcome'],
): boolean {
  // Splash, media hold, and the authenticated tree are separate navigators.
  // Sign In exists only on the signed-out stack, so a root NAVIGATE there is
  // unhandled and must not be dispatched.
  if (!mountedNavigatorHas(name)) return false;
  if (name === 'Welcome') {
    navigationRef.navigate('Welcome', params as RootStackParamList['Welcome']);
    return true;
  }
  navigationRef.navigate('SignIn', params as RootStackParamList['SignIn']);
  return true;
}

export function resetToSignedOut(
  name: 'GuestTabs' | 'SignIn' | 'ForgotPassword',
  params?: object,
): boolean {
  if (!navigationRef.isReady()) return false;
  navigationRef.reset({
    index: 0,
    routes: [{ name, params }],
  });
  return true;
}
