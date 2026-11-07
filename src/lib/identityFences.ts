/**
 * Authenticated request identity fences.
 * This module has no local imports so Node selftests can execute it directly.
 */

export class ApiError extends Error {
  status: number;
  code?: string;
  skillId?: string;
  nameEn?: string;
  categoryId?: string;

  constructor(
    status: number,
    message: string,
    details?: {
      code?: string;
      skillId?: string;
      nameEn?: string;
      categoryId?: string;
    },
  ) {
    super(message);
    this.status = status;
    this.code = details?.code;
    this.skillId = details?.skillId;
    this.nameEn = details?.nameEn;
    this.categoryId = details?.categoryId;
  }
}

export const ACCOUNT_SUSPENDED_CODE = 'ACCOUNT_SUSPENDED';
export const MAWAHIB_PROFILE_MISSING_CODE = 'MAWAHIB_PROFILE_MISSING';

export function isAccountSuspendedError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    error.code === ACCOUNT_SUSPENDED_CODE
  );
}

export function isMawahibProfileMissingError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    error.code === MAWAHIB_PROFILE_MISSING_CODE
  );
}

export type AuthenticatedRequestPrincipal = {
  userId: string;
  epoch: number;
};

export type GuestRequestPrincipal = {
  mode: 'guest';
  epoch: number;
};

export type RequestPrincipal =
  | AuthenticatedRequestPrincipal
  | GuestRequestPrincipal;

export class StaleIdentityError extends Error {
  readonly code = 'STALE_IDENTITY' as const;

  constructor(message = 'Request identity is no longer current') {
    super(message);
    this.name = 'StaleIdentityError';
  }
}

export function isStaleIdentityError(
  error: unknown,
): error is StaleIdentityError {
  return error instanceof StaleIdentityError;
}

export function isGuestRequestPrincipal(
  principal: RequestPrincipal,
): principal is GuestRequestPrincipal {
  return 'mode' in principal && principal.mode === 'guest';
}

export function principalsEqual(
  left: AuthenticatedRequestPrincipal,
  right: AuthenticatedRequestPrincipal | null,
): boolean {
  return Boolean(
    right && left.userId === right.userId && left.epoch === right.epoch,
  );
}

/** JWT `sub` without verifying the signature. Used only to ignore stale responses. */
export function accessTokenSubject(accessToken: string): string | null {
  const segment = accessToken.split('.')[1];
  if (!segment) return null;
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = globalThis.atob(padded);
    const payload = JSON.parse(decoded) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export function isGetRequestMethod(method: string | undefined): boolean {
  return (method ?? 'GET').toUpperCase() === 'GET';
}

export function normalizePublicApiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized !== '/public' && !normalized.startsWith('/public/')) {
    throw new Error('publicRequest may only call /public/* routes');
  }
  return normalized;
}

export type AcquireAuthenticatedTokenInput = {
  principal: AuthenticatedRequestPrincipal;
  preferredToken?: string;
  forceRefresh?: boolean;
  isRecoveryActive: () => boolean;
  currentPrincipal: () => AuthenticatedRequestPrincipal | null;
  getSession: () => Promise<{
    user: { id: string };
    access_token: string;
  } | null>;
  refreshSession: () => Promise<{
    user: { id: string };
    access_token: string;
  } | null>;
};

function assertCurrent(
  principal: AuthenticatedRequestPrincipal,
  input: Pick<
    AcquireAuthenticatedTokenInput,
    'isRecoveryActive' | 'currentPrincipal'
  >,
): void {
  if (input.isRecoveryActive()) {
    throw new StaleIdentityError('Recovery session cannot use the API client');
  }
  if (!principalsEqual(principal, input.currentPrincipal())) {
    throw new StaleIdentityError();
  }
}

function tokenForPrincipal(
  principal: AuthenticatedRequestPrincipal,
  token: string | undefined,
): string | null {
  if (!token) return null;
  return accessTokenSubject(token) === principal.userId ? token : null;
}

/**
 * Resolve a bearer token for a captured principal.
 * After any await, identity/epoch/recovery must still match. Never returns
 * another user's token.
 */
export async function acquireAuthenticatedToken(
  input: AcquireAuthenticatedTokenInput,
): Promise<string> {
  assertCurrent(input.principal, input);

  if (!input.forceRefresh) {
    const preferred = tokenForPrincipal(input.principal, input.preferredToken);
    if (preferred) {
      assertCurrent(input.principal, input);
      return preferred;
    }
  }

  const session = input.forceRefresh
    ? await input.refreshSession()
    : await input.getSession();

  assertCurrent(input.principal, input);

  if (!session?.access_token || session.user.id !== input.principal.userId) {
    if (session && session.user.id !== input.principal.userId) {
      throw new StaleIdentityError();
    }
    throw new ApiError(401, 'Not authenticated');
  }

  const token = tokenForPrincipal(input.principal, session.access_token);
  if (!token) {
    throw new StaleIdentityError();
  }
  return token;
}

export type AuthenticatedRequestInit = RequestInit & {
  /**
   * Known access token for this principal only (e.g. a just-created session).
   * Still identity-checked; never used for a different user.
   */
  accessToken?: string;
  principal?: AuthenticatedRequestPrincipal;
  acceptedStatuses?: number[];
};

export type AuthenticatedRequestDeps = {
  principal: AuthenticatedRequestPrincipal;
  getAuthenticatedToken: (
    principal: AuthenticatedRequestPrincipal,
    options?: { forceRefresh?: boolean; preferredToken?: string },
  ) => Promise<string>;
  isPrincipalCurrent: (principal: AuthenticatedRequestPrincipal) => boolean;
  isRecoveryActive: () => boolean;
  fetch: typeof fetch;
  apiBaseUrl: string;
  onAccountSuspended?: (accessToken: string) => void;
};

export type ConsumedResponse = {
  status: number;
  ok: boolean;
  json: unknown;
  text: string;
};

function assertLivePrincipal(
  principal: AuthenticatedRequestPrincipal,
  deps: Pick<AuthenticatedRequestDeps, 'isPrincipalCurrent' | 'isRecoveryActive'>,
): void {
  if (deps.isRecoveryActive() || !deps.isPrincipalCurrent(principal)) {
    throw new StaleIdentityError();
  }
}

/**
 * Read the entire body before any identity-sensitive result is applied.
 * 204, empty, JSON, and non-JSON error text are all consumed here.
 */
export async function consumeResponseBody(
  res: Pick<Response, 'status' | 'ok' | 'text'>,
): Promise<ConsumedResponse> {
  const text = await res.text();
  if (!text) {
    return { status: res.status, ok: res.ok, json: undefined, text: '' };
  }
  try {
    return {
      status: res.status,
      ok: res.ok,
      json: JSON.parse(text) as unknown,
      text,
    };
  } catch {
    return { status: res.status, ok: res.ok, json: undefined, text };
  }
}

function apiErrorFromConsumed(consumed: ConsumedResponse): ApiError {
  let message = `Request failed (${consumed.status})`;
  const body = consumed.json as
    | {
        message?: string | string[];
        code?: string;
        skillId?: string;
        nameEn?: string;
        categoryId?: string;
      }
    | undefined;
  if (body && typeof body === 'object') {
    if (Array.isArray(body.message)) message = body.message.join(', ');
    else if (body.message) message = body.message;
    return new ApiError(consumed.status, message, {
      code: body.code,
      skillId: body.skillId,
      nameEn: body.nameEn,
      categoryId: body.categoryId,
    });
  }
  if (consumed.text) message = consumed.text;
  return new ApiError(consumed.status, message);
}

/**
 * Authenticated Nest request.
 *
 * Token acquisition → pre-dispatch fence → fetch → consume entire body →
 * FINAL identity fence → only then return, throw, or notify.
 */
export async function executeAuthenticatedRequest<T>(
  path: string,
  init: AuthenticatedRequestInit,
  deps: AuthenticatedRequestDeps,
): Promise<T> {
  const { accessToken: preferredToken, principal: _ignored, acceptedStatuses, ...rest } = init;
  const method = (rest.method ?? 'GET').toString();
  const allowGetRetry = isGetRequestMethod(method);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let retriedGet = false;

  for (;;) {
    assertLivePrincipal(deps.principal, deps);
    const token = await deps.getAuthenticatedToken(deps.principal, {
      forceRefresh: retriedGet,
      preferredToken: retriedGet ? undefined : preferredToken,
    });
    // Pre-dispatch fence: identity must still match immediately before send.
    assertLivePrincipal(deps.principal, deps);

    const headers = new Headers(rest.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('Authorization', `Bearer ${token}`);

    const res = await deps.fetch(`${deps.apiBaseUrl}${normalizedPath}`, {
      ...rest,
      headers,
    });
    const consumed = await consumeResponseBody(res);

    // FINAL fence: after the entire body is consumed, before any result.
    assertLivePrincipal(deps.principal, deps);

    if (consumed.status === 401 && allowGetRetry && !retriedGet) {
      const unauthorized = apiErrorFromConsumed(consumed);
      if (isMawahibProfileMissingError(unauthorized)) {
        throw unauthorized;
      }
      retriedGet = true;
      continue;
    }

    if (!consumed.ok) {
      const error = apiErrorFromConsumed(consumed);
      if (isAccountSuspendedError(error)) {
        deps.onAccountSuspended?.(token);
      }
      throw error;
    }
    if (acceptedStatuses && !acceptedStatuses.includes(consumed.status)) {
      throw new ApiError(consumed.status, 'The response was not a confirmation.');
    }

    if (consumed.status === 204 || consumed.json === undefined) {
      return undefined as T;
    }
    return consumed.json as T;
  }
}

export type PublicRequestDeps = {
  fetch: typeof fetch;
  apiBaseUrl: string;
};

/**
 * Future Guest public client.
 * Never reads a session and never attaches Authorization.
 * Not used by product screens in Phase A.
 */
export async function executePublicRequest<T>(
  path: string,
  init: RequestInit = {},
  deps: PublicRequestDeps,
): Promise<T> {
  const normalizedPath = normalizePublicApiPath(path);
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (headers.has('Authorization')) {
    headers.delete('Authorization');
  }

  const res = await deps.fetch(`${deps.apiBaseUrl}${normalizedPath}`, {
    ...init,
    headers,
  });
  const consumed = await consumeResponseBody(res);
  if (!consumed.ok) {
    let message = `Request failed (${consumed.status})`;
    const body = consumed.json as { message?: string | string[] } | undefined;
    if (body && typeof body === 'object') {
      if (Array.isArray(body.message)) message = body.message.join(', ');
      else if (body.message) message = body.message;
    }
    throw new ApiError(consumed.status, message);
  }
  if (consumed.status === 204 || consumed.json === undefined) {
    return undefined as T;
  }
  return consumed.json as T;
}
