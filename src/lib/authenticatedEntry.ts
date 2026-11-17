export type AuthenticatedEntryRoute = {
  name: string;
  params?: object;
};

export type AuthenticatedEntryDecision =
  | { type: 'done' }
  | { type: 'wait' }
  | { type: 'reset'; index: number; routes: AuthenticatedEntryRoute[] };

/**
 * Open a saved authenticated entry only on the navigator that owns every
 * route. An early attempt waits and is retried when the route list changes.
 * The caller marks the entry consumed only after `done` or `reset`.
 */
export function authenticatedEntryDecision(input: {
  pending: AuthenticatedEntryRoute[] | null;
  routeNames: readonly string[];
  consumed: boolean;
}): AuthenticatedEntryDecision {
  if (input.consumed) return { type: 'done' };
  const pending = input.pending;
  if (!pending || pending.length === 0) return { type: 'done' };
  const onlyDefaultHome =
    pending.length === 1 &&
    pending[0].name === 'MainTabs' &&
    pending[0].params == null;
  if (onlyDefaultHome) return { type: 'done' };
  const ready = pending.every((route) => input.routeNames.includes(route.name));
  if (!ready) return { type: 'wait' };
  return { type: 'reset', index: pending.length - 1, routes: pending };
}
