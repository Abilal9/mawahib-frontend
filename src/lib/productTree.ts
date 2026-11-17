import { consumeProcessStart } from './processStart';
import { resetPrivateModuleCaches } from './privateModuleCaches';
import {
  consumeReturnIntentRoutes,
  invalidateReturnIntents,
} from './returnIntent';
import { resolveSignedOutDestination } from './signedOutDestination';
import {
  markAuthenticatedProcess,
  setSignedOutReason,
} from './signedOutReason';
import type { SignedOutStackParamList } from '../navigation/types';

export type ProductTreeRoute = {
  name: string;
  params?: object;
};

type SignedOutEntry = {
  name: keyof SignedOutStackParamList;
  params?: object;
};

let epoch = 0;
let authenticatedProductActive = false;
let authenticatedEntry: ProductTreeRoute[] | null = null;
let signedOutEntry: SignedOutEntry | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  epoch += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeProductTree(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getProductTreeEpoch(): number {
  return epoch;
}

export function isAuthenticatedProductActive(): boolean {
  return authenticatedProductActive;
}

export function enterAuthenticatedProduct(
  routes: ProductTreeRoute[] = [{ name: 'MainTabs' }],
): void {
  consumeProcessStart();
  markAuthenticatedProcess();
  setSignedOutReason('none');
  resetPrivateModuleCaches();
  authenticatedProductActive = true;
  const restored = consumeReturnIntentRoutes();
  authenticatedEntry =
    restored ?? (routes.length > 0 ? routes : [{ name: 'MainTabs' }]);
  signedOutEntry = null;
  emit();
}

export function leaveAuthenticatedProduct(
  nextSignedOut?: SignedOutEntry,
): void {
  consumeProcessStart();
  invalidateReturnIntents();
  authenticatedProductActive = false;
  authenticatedEntry = null;
  signedOutEntry = nextSignedOut ?? resolveSignedOutDestination();
  resetPrivateModuleCaches();
  emit();
}

export function enterSignedOutAt(next: SignedOutEntry): void {
  consumeProcessStart();
  authenticatedProductActive = false;
  authenticatedEntry = null;
  signedOutEntry = next;
  emit();
}

export function peekAuthenticatedEntry(): ProductTreeRoute[] | null {
  return authenticatedEntry;
}

export function takeAuthenticatedEntry(): ProductTreeRoute[] | null {
  const next = authenticatedEntry;
  authenticatedEntry = null;
  return next;
}

export function takeSignedOutEntry(): SignedOutEntry | null {
  const next = signedOutEntry;
  signedOutEntry = null;
  return next;
}

export function peekSignedOutEntry(): SignedOutEntry | null {
  return signedOutEntry;
}
