/**
 * Return-intent cancellation for optional authentication screens.
 * Internal auth-flow Back preserves a live intent. Leaving for Guest or
 * public content invalidates it. Successful product-tree consumption is
 * not a POP and must not be handled here.
 *
 * No local imports so Node selftests can execute this module.
 */

export const AUTH_FLOW_ROUTES = new Set([
  'Welcome',
  'AccountType',
  'SignIn',
  'SignUp',
  'ConfirmCode',
  'VerifyAccount',
  'SignupSuccess',
  'TurnOnNotifications',
]);

const REMOVE_ACTIONS = new Set(['GO_BACK', 'POP', 'POP_TO_TOP']);
const IGNORE_ACTIONS = new Set(['REPLACE', 'NAVIGATE', 'PUSH', 'RESET']);

export function shouldInvalidateIntentOnAuthRemove(input: {
  actionType: string;
  routes: Array<{ name: string }>;
  index: number;
  count?: number;
}): boolean {
  const type = input.actionType;
  if (IGNORE_ACTIONS.has(type)) return false;
  if (!REMOVE_ACTIONS.has(type)) return false;

  const index = Number.isFinite(input.index) ? input.index : 0;
  let targetIndex: number;
  if (type === 'POP_TO_TOP') {
    targetIndex = 0;
  } else if (type === 'POP') {
    const count =
      Number.isFinite(input.count) && (input.count as number) > 0
        ? (input.count as number)
        : 1;
    targetIndex = index - count;
  } else {
    targetIndex = index - 1;
  }

  if (targetIndex < 0) return true;
  const target = input.routes[targetIndex]?.name;
  if (!target) return true;
  return !AUTH_FLOW_ROUTES.has(target);
}
