/**
 * Return-intent helpers stay import-free so Node selftests can execute this
 * module directly (same convention as mediaCacheOwner).
 *
 * UUID rule matches `isBackendUserId`. Recovery lock uses the same storage
 * key as `recoveryState` — any present lock drops consume.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECOVERY_STORAGE_KEY = 'mawahib.passwordRecovery.v1';

export const RETURN_INTENT_TTL_MS = 10 * 60 * 1000;
export const RETURN_INTENT_STORAGE_KEY = 'mawahib.returnIntent.v1';

function isBackendUserId(id: string | null | undefined): boolean {
  return Boolean(id && UUID_RE.test(id));
}

function hasRecoveryLock(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(RECOVERY_STORAGE_KEY) != null;
  } catch {
    return true;
  }
}

export const ALLOWED_RETURN_ROUTES = [
  'GuestTabs',
  'UserProfile',
  'PostDetail',
  'ServiceDetail',
  'JobListingDetail',
  'Reviews',
  'PortfolioProjectDetail',
] as const;

export type AllowedReturnRoute = (typeof ALLOWED_RETURN_ROUTES)[number];

export type ReturnIntentAction =
  | 'save'
  | 'like'
  | 'comment'
  | 'connect'
  | 'message'
  | 'apply'
  | 'request'
  | 'create'
  | 'review'
  | 'private'
  | 'messages'
  | 'jobs';

export type GuestTabIntentScreen =
  | 'HomeTab'
  | 'SearchTab'
  | 'MessagesTab'
  | 'JobsTab';

export type GuestTabsReturnParams = {
  screen?: GuestTabIntentScreen;
};

export type ReturnIntentParams =
  | GuestTabsReturnParams
  | { userId: string }
  | { postId: string }
  | { serviceId: string; userId?: string }
  | { listingId: string }
  | { userId?: string; serviceId?: string }
  | { projectId: string; userId?: string };

export type ReturnIntent = {
  route: AllowedReturnRoute;
  params: ReturnIntentParams;
  action?: ReturnIntentAction;
  epoch: number;
  processId: string;
  createdAt: number;
  consumed: boolean;
};

export type AuthenticatedRestoreRoute = {
  name:
    | 'MainTabs'
    | 'UserProfile'
    | 'PostDetail'
    | 'ServiceDetail'
    | 'JobListingDetail'
    | 'Reviews'
    | 'PortfolioProjectDetail';
  params?: object;
};

const REJECTED_ROUTES = new Set([
  'Chat',
  'Saved',
  'Settings',
  'Notifications',
  'WorkRequestDetail',
  'ConfirmPayment',
  'ApplePay',
  'CardPayment',
  'Connections',
  'PostCreate',
  'PostJob',
  'EditProfile',
  'ChangePassword',
  'MainTabs',
  'Messages',
  'MessagesTab',
  'JobsTab',
  'DirectRequest',
  'RequestService',
  'WriteReview',
  'Premium',
  'Calendar',
]);

let generation = 0;
let processId = createProcessId();
let memoryIntent: ReturnIntent | null = null;

function createProcessId(): string {
  return `p${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getReturnIntentProcessId(): string {
  return processId;
}

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function isAllowedRoute(value: unknown): value is AllowedReturnRoute {
  return (
    typeof value === 'string' &&
    (ALLOWED_RETURN_ROUTES as readonly string[]).includes(value)
  );
}

function isAction(value: unknown): value is ReturnIntentAction {
  return (
    value === 'save' ||
    value === 'like' ||
    value === 'comment' ||
    value === 'connect' ||
    value === 'message' ||
    value === 'apply' ||
    value === 'request' ||
    value === 'create' ||
    value === 'review' ||
    value === 'private' ||
    value === 'messages' ||
    value === 'jobs'
  );
}

function onlyKeys(params: object, allowed: string[]): boolean {
  return Object.keys(params).every((key) => allowed.includes(key));
}

function rejectUnsafeValue(value: unknown): boolean {
  if (value === undefined) return false;
  if (typeof value === 'function') return true;
  if (typeof value === 'object' && value !== null) return true;
  if (typeof value === 'symbol') return true;
  return false;
}

export function sanitizeReturnIntentInput(input: {
  route: unknown;
  params?: unknown;
  action?: unknown;
}): { route: AllowedReturnRoute; params: ReturnIntentParams; action?: ReturnIntentAction } | null {
  if (!isAllowedRoute(input.route)) return null;
  if (typeof input.route === 'string' && REJECTED_ROUTES.has(input.route)) {
    return null;
  }
  if (input.params != null && (typeof input.params !== 'object' || Array.isArray(input.params))) {
    return null;
  }
  const raw = (input.params ?? {}) as Record<string, unknown>;
  for (const value of Object.values(raw)) {
    if (rejectUnsafeValue(value)) return null;
  }
  const action = input.action === undefined ? undefined : input.action;
  if (action !== undefined && !isAction(action)) return null;

  if (input.route === 'GuestTabs') {
    if (!onlyKeys(raw, ['screen'])) return null;
    const screen = raw.screen;
    if (
      screen !== undefined &&
      screen !== 'HomeTab' &&
      screen !== 'SearchTab' &&
      screen !== 'MessagesTab' &&
      screen !== 'JobsTab'
    ) {
      return null;
    }
    return {
      route: 'GuestTabs',
      params: screen ? { screen } : {},
      action,
    };
  }

  if (input.route === 'UserProfile') {
    if (!onlyKeys(raw, ['userId'])) return null;
    if (!isBackendUserId(typeof raw.userId === 'string' ? raw.userId : null)) return null;
    return { route: 'UserProfile', params: { userId: raw.userId as string }, action };
  }

  if (input.route === 'PostDetail') {
    if (!onlyKeys(raw, ['postId'])) return null;
    if (!isBackendUserId(typeof raw.postId === 'string' ? raw.postId : null)) return null;
    return { route: 'PostDetail', params: { postId: raw.postId as string }, action };
  }

  if (input.route === 'ServiceDetail') {
    if (!onlyKeys(raw, ['serviceId', 'userId'])) return null;
    if (!isBackendUserId(typeof raw.serviceId === 'string' ? raw.serviceId : null)) {
      return null;
    }
    if (raw.userId !== undefined && !isBackendUserId(typeof raw.userId === 'string' ? raw.userId : null)) {
      return null;
    }
    return {
      route: 'ServiceDetail',
      params: {
        serviceId: raw.serviceId as string,
        ...(typeof raw.userId === 'string' ? { userId: raw.userId } : {}),
      },
      action,
    };
  }

  if (input.route === 'JobListingDetail') {
    if (!onlyKeys(raw, ['listingId'])) return null;
    if (!isBackendUserId(typeof raw.listingId === 'string' ? raw.listingId : null)) {
      return null;
    }
    return {
      route: 'JobListingDetail',
      params: { listingId: raw.listingId as string },
      action,
    };
  }

  if (input.route === 'Reviews') {
    if (!onlyKeys(raw, ['userId', 'serviceId'])) return null;
    const userId = raw.userId;
    const serviceId = raw.serviceId;
    if (userId !== undefined && !isBackendUserId(typeof userId === 'string' ? userId : null)) {
      return null;
    }
    if (
      serviceId !== undefined &&
      !isBackendUserId(typeof serviceId === 'string' ? serviceId : null)
    ) {
      return null;
    }
    if (!userId && !serviceId) return null;
    return {
      route: 'Reviews',
      params: {
        ...(typeof userId === 'string' ? { userId } : {}),
        ...(typeof serviceId === 'string' ? { serviceId } : {}),
      },
      action,
    };
  }

  if (input.route === 'PortfolioProjectDetail') {
    if (!onlyKeys(raw, ['projectId', 'userId'])) return null;
    if (!isBackendUserId(typeof raw.projectId === 'string' ? raw.projectId : null)) {
      return null;
    }
    if (raw.userId !== undefined && !isBackendUserId(typeof raw.userId === 'string' ? raw.userId : null)) {
      return null;
    }
    return {
      route: 'PortfolioProjectDetail',
      params: {
        projectId: raw.projectId as string,
        ...(typeof raw.userId === 'string' ? { userId: raw.userId } : {}),
      },
      action,
    };
  }

  return null;
}

export function getReturnIntentGeneration(): number {
  return generation;
}

export function invalidateReturnIntents(): void {
  generation += 1;
  memoryIntent = null;
  clearPersistedReturnIntent();
}

function clearPersistedReturnIntent(): void {
  if (!storageAvailable()) return;
  try {
    localStorage.removeItem(RETURN_INTENT_STORAGE_KEY);
  } catch {
    // Corrupt or unavailable storage must not crash startup.
  }
}

function persistReturnIntent(intent: ReturnIntent): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(RETURN_INTENT_STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // Persistence is best-effort for OTP/signup hops.
  }
}

function readPersistedReturnIntent(): ReturnIntent | null {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(RETURN_INTENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const intent = parseStoredIntent(parsed);
    if (!intent) {
      clearPersistedReturnIntent();
      return null;
    }
    return intent;
  } catch {
    clearPersistedReturnIntent();
    return null;
  }
}

export function parseStoredIntent(value: unknown): ReturnIntent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.consumed === true) return null;
  if (typeof record.epoch !== 'number' || !Number.isFinite(record.epoch)) return null;
  if (typeof record.processId !== 'string' || record.processId.length < 4) {
    return null;
  }
  if (typeof record.createdAt !== 'number' || !Number.isFinite(record.createdAt)) {
    return null;
  }
  const sanitized = sanitizeReturnIntentInput({
    route: record.route,
    params: record.params,
    action: record.action,
  });
  if (!sanitized) return null;
  return {
    route: sanitized.route,
    params: sanitized.params,
    action: sanitized.action,
    epoch: record.epoch,
    processId: record.processId,
    createdAt: record.createdAt,
    consumed: false,
  };
}

export function isReturnIntentFresh(
  intent: Pick<ReturnIntent, 'createdAt' | 'epoch' | 'processId' | 'consumed'>,
  now: number,
  liveEpoch: number,
  liveProcessId: string = processId,
): boolean {
  if (intent.consumed) return false;
  if (intent.processId !== liveProcessId) return false;
  if (intent.epoch !== liveEpoch) return false;
  if (!Number.isFinite(intent.createdAt) || intent.createdAt > now) return false;
  if (now - intent.createdAt >= RETURN_INTENT_TTL_MS) return false;
  return true;
}

/** Stage in memory only. Do not persist until Sign In / Create Account. */
export function stageReturnIntent(input: {
  route: unknown;
  params?: unknown;
  action?: unknown;
  now?: number;
}): ReturnIntent | null {
  const sanitized = sanitizeReturnIntentInput(input);
  if (!sanitized) return null;
  const intent: ReturnIntent = {
    route: sanitized.route,
    params: sanitized.params,
    action: sanitized.action,
    epoch: generation,
    processId,
    createdAt: input.now ?? Date.now(),
    consumed: false,
  };
  memoryIntent = intent;
  return intent;
}

/** Persist the staged/current intent when the user chooses Sign In or Create Account. */
export function persistStagedReturnIntent(intent?: ReturnIntent | null): boolean {
  const next = intent ?? memoryIntent;
  if (!next) return false;
  if (!isReturnIntentFresh(next, Date.now(), generation)) {
    memoryIntent = null;
    clearPersistedReturnIntent();
    return false;
  }
  memoryIntent = next;
  persistReturnIntent(next);
  return true;
}

export function clearStagedReturnIntent(): void {
  memoryIntent = null;
}

export function peekReturnIntent(): ReturnIntent | null {
  return memoryIntent ?? readPersistedReturnIntent();
}

export function mapReturnIntentToAuthenticated(
  intent: ReturnIntent,
): AuthenticatedRestoreRoute | null {
  if (intent.route === 'GuestTabs') {
    const screen = (intent.params as GuestTabsReturnParams).screen;
    if (screen === 'SearchTab') {
      return { name: 'MainTabs', params: { screen: 'SearchTab' } };
    }
    if (screen === 'MessagesTab') {
      return { name: 'MainTabs', params: { screen: 'MessagesTab' } };
    }
    if (screen === 'JobsTab') {
      return { name: 'MainTabs', params: { screen: 'JobsTab' } };
    }
    return { name: 'MainTabs' };
  }
  if (intent.route === 'Reviews') {
    const params = intent.params as { userId?: string; serviceId?: string };
    if (params.serviceId && !params.userId) {
      return { name: 'ServiceDetail', params: { serviceId: params.serviceId } };
    }
    if (params.userId) {
      return { name: 'Reviews', params: { userId: params.userId } };
    }
    return null;
  }
  if (intent.route === 'UserProfile') {
    return { name: 'UserProfile', params: intent.params };
  }
  if (intent.route === 'PostDetail') {
    return { name: 'PostDetail', params: intent.params };
  }
  if (intent.route === 'ServiceDetail') {
    return { name: 'ServiceDetail', params: intent.params };
  }
  if (intent.route === 'JobListingDetail') {
    return { name: 'JobListingDetail', params: intent.params };
  }
  if (intent.route === 'PortfolioProjectDetail') {
    return { name: 'PortfolioProjectDetail', params: intent.params };
  }
  return null;
}

/**
 * One-shot consume. Only a persisted Sign In / Create Account intent is
 * eligible. Staged-in-memory gate state is dropped, not restored.
 * Clears memory + storage synchronously before mapping so duplicate
 * post-auth effects cannot navigate twice.
 */
function markPersistedIntentConsumed(intent: ReturnIntent): boolean {
  if (!storageAvailable()) return true;
  try {
    localStorage.setItem(
      RETURN_INTENT_STORAGE_KEY,
      JSON.stringify({ ...intent, consumed: true }),
    );
    return true;
  } catch {
    return false;
  }
}

export function takeReturnIntent(now: number = Date.now()): AuthenticatedRestoreRoute | null {
  const current = readPersistedReturnIntent();
  memoryIntent = null;
  if (!current) {
    clearPersistedReturnIntent();
    return null;
  }
  if (hasRecoveryLock() || !isReturnIntentFresh(current, now, generation)) {
    markPersistedIntentConsumed(current);
    clearPersistedReturnIntent();
    return null;
  }
  const marked = markPersistedIntentConsumed(current);
  clearPersistedReturnIntent();
  if (!marked) return null;
  return mapReturnIntentToAuthenticated(current);
}

export function consumeReturnIntentRoutes(
  now: number = Date.now(),
): Array<{ name: string; params?: object }> | null {
  const mapped = takeReturnIntent(now);
  if (!mapped) return null;
  if (mapped.name === 'MainTabs') {
    return [{ name: 'MainTabs', params: mapped.params }];
  }
  return [{ name: 'MainTabs' }, { name: mapped.name, params: mapped.params }];
}

/** Test helper. Not used by product code. */
export function resetReturnIntentForTests(): void {
  generation = 0;
  processId = createProcessId();
  memoryIntent = null;
  clearPersistedReturnIntent();
}
