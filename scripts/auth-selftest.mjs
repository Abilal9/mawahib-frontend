/**
 * Run: node scripts/auth-selftest.mjs
 * Phone local-digit + E.164 assertions aligned with src/lib/phone.ts.
 */
import assert from 'node:assert/strict';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const SA_MOBILE_NATIONAL = /^5\d{8}$/;
const AE_MOBILE_NATIONAL = /^5\d{8}$/;

function maxNationalDigits(country) {
  if (country === 'SA' || country === 'AE') return 9;
  return 15;
}

function sanitizeNationalInput(raw, country) {
  return String(raw).replace(/\D/g, '').slice(0, maxNationalDigits(country));
}

function toE164(nationalNumber, country) {
  const digits = sanitizeNationalInput(nationalNumber, country);
  if (!digits) return null;
  if (country === 'SA') {
    if (!SA_MOBILE_NATIONAL.test(digits)) return null;
    return `+966${digits}`;
  }
  if (country === 'AE') {
    if (!AE_MOBILE_NATIONAL.test(digits)) return null;
    const parsed = parsePhoneNumberFromString(digits, 'AE');
    if (!parsed || !parsed.isValid()) return null;
    const e164 = parsed.format('E.164');
    if (!/^\+9715\d{8}$/.test(e164)) return null;
    return e164;
  }
  const parsed = parsePhoneNumberFromString(digits, country);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.format('E.164');
}

function getPhoneValidationMessage(nationalNumber, country) {
  const digits = sanitizeNationalInput(nationalNumber, country);
  if (!digits) return null;
  if (country === 'SA') {
    if (digits[0] !== '5') return 'Saudi mobile numbers must start with 5';
    if (digits.length < 9) return 'Enter a 9-digit mobile number';
    return null;
  }
  if (country === 'AE') {
    if (digits[0] !== '5') return 'Enter a valid UAE mobile number';
    if (digits.length < 9) return 'Enter a 9-digit mobile number';
    if (!toE164(digits, 'AE')) return 'Enter a valid UAE mobile number';
    return null;
  }
  return null;
}

// --- Saudi ---
assert.equal(maxNationalDigits('SA'), 9);
assert.equal(sanitizeNationalInput('5609006009', 'SA'), '560900600'); // no 10th digit
assert.equal(sanitizeNationalInput('+560900600', 'SA'), '560900600'); // no +
assert.equal(sanitizeNationalInput('56ab0900600', 'SA'), '560900600');
assert.equal(toE164('560900600', 'SA'), '+966560900600');
assert.equal(toE164('501234567', 'SA'), '+966501234567');
assert.equal(toE164('401234567', 'SA'), null);
assert.equal(toE164('50123456', 'SA'), null); // 8 digits
assert.equal(
  getPhoneValidationMessage('4', 'SA'),
  'Saudi mobile numbers must start with 5',
);
assert.equal(
  getPhoneValidationMessage('50123456', 'SA'),
  'Enter a 9-digit mobile number',
);
assert.equal(getPhoneValidationMessage('501234567', 'SA'), null);

// --- UAE ---
assert.equal(maxNationalDigits('AE'), 9);
assert.equal(sanitizeNationalInput('5012345678', 'AE'), '501234567'); // no 10th digit
assert.equal(toE164('501234567', 'AE'), '+971501234567');
assert.equal(toE164('401234567', 'AE'), null);
assert.equal(toE164('50123456', 'AE'), null); // 8 digits
assert.equal(
  getPhoneValidationMessage('4', 'AE'),
  'Enter a valid UAE mobile number',
);
assert.equal(
  getPhoneValidationMessage('50123456', 'AE'),
  'Enter a 9-digit mobile number',
);
assert.equal(getPhoneValidationMessage('501234567', 'AE'), null);

// --- Other countries keep flexible max ---
assert.equal(maxNationalDigits('US'), 15);

console.log('auth-selftest phone rules: ok');

// --- Pending OTP honesty (mirrors src/lib/pendingSignup.ts) ---
const RESUMABLE_OTP_WINDOW_MS = 60 * 60 * 1000;
const mem = new Map();
const storage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const STORAGE_KEY = 'mawahib.pendingSignup.v1';

function savePendingSignup(pending, options = {}) {
  const now = Date.now();
  const raw = storage.getItem(STORAGE_KEY);
  const existing = raw ? JSON.parse(raw) : null;
  const sameEmail =
    existing?.email === pending.email.trim().toLowerCase() ? existing : null;
  let lastOtpRequestedAt = sameEmail?.lastOtpRequestedAt;
  if (options.otpRequested) lastOtpRequestedAt = now;
  const payload = {
    ...pending,
    email: pending.email.trim().toLowerCase(),
    createdAt: pending.createdAt ?? sameEmail?.createdAt ?? now,
    ...(lastOtpRequestedAt !== undefined ? { lastOtpRequestedAt } : {}),
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadPendingSignup() {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

function hasResumablePendingVerification(email) {
  const pending = loadPendingSignup();
  if (!pending) return false;
  if (pending.email !== email.trim().toLowerCase()) return false;
  const at = pending.lastOtpRequestedAt;
  if (typeof at !== 'number' || !Number.isFinite(at)) return false;
  return Date.now() - at <= RESUMABLE_OTP_WINDOW_MS;
}

mem.clear();
savePendingSignup({ email: 'a@example.com' }); // email_not_confirmed style — no otpRequested
assert.equal(hasResumablePendingVerification('a@example.com'), false);
assert.equal(loadPendingSignup()?.lastOtpRequestedAt, undefined);

savePendingSignup({ email: 'a@example.com' }, { otpRequested: true });
assert.equal(hasResumablePendingVerification('a@example.com'), true);
assert.equal(typeof loadPendingSignup()?.lastOtpRequestedAt, 'number');

savePendingSignup({ email: 'a@example.com' }); // preserve stamp, do not invent if missing was already set
assert.equal(typeof loadPendingSignup()?.lastOtpRequestedAt, 'number');

mem.clear();
savePendingSignup({
  email: 'old@example.com',
  createdAt: Date.now(),
  // forged: only createdAt — must not resume
});
const forged = loadPendingSignup();
assert.ok(forged);
assert.equal(hasResumablePendingVerification('old@example.com'), false);

console.log('auth-selftest pending OTP honesty: ok');

// --- Post-auth gate (mirrors src/lib/postAuthGate.ts) ---
function resolvePostAuthDestination(input) {
  const email =
    input.apiUser?.email ||
    input.session?.user?.email ||
    input.signUpBasics?.email ||
    input.pendingEmail ||
    '';
  const phoneE164 =
    input.apiUser?.phoneE164 ||
    input.signUpBasics?.phoneE164 ||
    input.pendingPhoneE164 ||
    '';
  const emailVerified = Boolean(
    input.apiUser?.emailVerified ||
      input.session?.user?.email_confirmed_at ||
      input.session?.user?.confirmed_at,
  );
  if (!emailVerified) {
    if (email) return { name: 'ConfirmCode', params: { email } };
    return { name: 'SignIn' };
  }
  const phoneVerified = Boolean(input.apiUser?.phoneVerified);
  if (phoneE164 && !phoneVerified) {
    return {
      name: 'VerifyAccount',
      params: { email: email || input.apiUser?.email || '', phoneE164 },
    };
  }
  if (input.flow === 'verify' || input.flow === 'deeplink') {
    return { name: 'TurnOnNotifications' };
  }
  if (input.apiUser) return { name: 'MainTabs' };
  return { name: 'SignIn' };
}

assert.equal(
  resolvePostAuthDestination({
    flow: 'verify',
    apiUser: {
      email: 't@example.com',
      emailVerified: true,
      phoneE164: '+966501234567',
      phoneVerified: false,
    },
    session: null,
  }).name,
  'VerifyAccount',
);
assert.equal(
  resolvePostAuthDestination({
    flow: 'restore',
    apiUser: {
      email: 't@example.com',
      emailVerified: true,
      phoneE164: '+966501234567',
      phoneVerified: false,
    },
    session: null,
  }).name,
  'VerifyAccount',
);
assert.equal(
  resolvePostAuthDestination({
    flow: 'signin',
    apiUser: { email: 't@example.com', emailVerified: true },
    session: null,
  }).name,
  'MainTabs',
);
assert.equal(
  resolvePostAuthDestination({
    flow: 'verify',
    apiUser: null,
    session: null,
    pendingEmail: 'u@example.com',
  }).name,
  'ConfirmCode',
);

console.log('auth-selftest post-auth gate: ok');

// --- Hydrate override merge (deterministic coalesce helper) ---
function mergeHydrateOverrides(base, next) {
  if (!base && !next) return undefined;
  if (!next) return base;
  if (!base) return next;
  const merged = { ...base };
  for (const key of Object.keys(next)) {
    if (next[key] !== undefined) merged[key] = next[key];
  }
  return merged;
}

let pending = mergeHydrateOverrides(undefined, { accountType: 'talent' });
pending = mergeHydrateOverrides(pending, {
  phoneE164: '+966501234567',
  displayName: 'Ada',
});
assert.deepEqual(pending, {
  accountType: 'talent',
  phoneE164: '+966501234567',
  displayName: 'Ada',
});
pending = mergeHydrateOverrides(pending, { accountType: 'business' });
assert.equal(pending.accountType, 'business');
assert.equal(pending.phoneE164, '+966501234567');

console.log('auth-selftest hydrate merge: ok');
console.log('auth-selftest: all ok');
