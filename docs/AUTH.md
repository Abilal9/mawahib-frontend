# Authentication

Primary frontend Auth behavior reference for Mawahib. Architecture is frozen; product Auth UI that is not implemented must not be described as available.

```text
React Native / Expo
  → Supabase Auth (identity, email OTP, sessions)
  → NestJS JWT (JWKS)
  → GET /users/me | POST /auth/bootstrap
  → Prisma → PostgreSQL
```

- **Supabase** owns credentials, email OTP delivery, sessions, and Auth identity.
- **Nest** owns the Mawahib user/profile and authorization.
- Do **not** build a custom OTP, email, or SMS system.

---

## Canonical signup (email OTP — required)

```text
Create Account (email + password + phone E.164 + location)
  → supabase.auth.signUp (no emailRedirectTo on happy path)
  → outcome (see below)
  → if otp_sent: ConfirmCode → verifyOtp({ type: 'email' })
  → Supabase session
  → GET /users/me → POST /auth/bootstrap if 404
  → resolvePostAuthDestination
  → optional phone step (Skip allowed) → TurnOnNotifications / MainTabs
```

### Signup outcomes

| Status | Meaning | UI |
|--------|---------|----|
| `otp_sent` | Fresh signup; confirmation OTP email was requested successfully | ConfirmCode |
| `session_ready` | Session returned immediately (e.g. auto-confirm); Nest hydrate succeeded | `resolvePostAuthDestination({ flow: 'verify' })` |
| `already_verified` | Supabase anti-enumeration / empty `identities` — **no** OTP claimed | Login / Change Email recovery |
| `ambiguous` | Email already registered signal — **no** OTP claimed | Login / Continue Verification / Change Email |

ConfirmCode is opened only when an OTP was actually requested (`otp_sent`), or when a later **successful** resend stamps pending verification.

Browser confirmation links are **not** the primary signup path. `AuthDeepLinkListener` still handles inbound signup and confirmation URLs. Those paths hydrate Nest and pass `resolvePostAuthDestination`.

A password-recovery URL (`type=recovery`, or an access token whose `amr` method is `recovery`) is rejected **before** `setSession` or `exchangeCodeForSession`. Relabeling that link as `type=signup` does not create a session. Other token links are accepted only when the token email matches the pending signup already stored on this device.

---

## OTP delivery honesty / resume

Non-sensitive pending context may be stored locally (`email`, `phoneE164`, account type, location — **never** passwords or OTP tokens).

| Rule | Behavior |
|------|----------|
| When is `lastOtpRequestedAt` set? | **Only** after a successful signup confirmation send or successful `resend({ type: 'signup' })` |
| `email_not_confirmed` on password sign-in | Does **not** stamp `lastOtpRequestedAt` (no OTP was sent by that failure) |
| `hasResumablePendingVerification` | True only if the same email has a recent successful `lastOtpRequestedAt` (not bare `createdAt`) |
| Rate-limited / failed resend | Do **not** fake “code sent”; may still open ConfirmCode only if a legitimate recent stamp already exists |

Abandoned signup: app restart may resume ConfirmCode when a successful send was recorded; otherwise offer truthful resend first.

---

## Email verification recovery

| Situation | Behavior |
|-----------|----------|
| Unverified user signs in | Alert → **Resend code**; on success → ConfirmCode; on failure/rate-limit → truthful error (reuse ConfirmCode only if resumable pending exists) |
| Re-signup with verified duplicate | `already_verified` → Login / Change Email (**no** fake OTP) |
| Re-signup with ambiguous / existing email | `ambiguous` → Login / Continue Verification / Change Email (**no** fake OTP unless Continue Verification resends successfully) |
| ConfirmCode edit email (pink pencil) | Clears pending; returns to SignUp with draft preserved |
| Invalid / expired OTP | Generic invalid/expired message; resend when cooldown allows |

Email verification is **required** before MainTabs. Phone verification is optional.

---

## Sign-in (verified)

```text
signInWithPassword
  → Supabase session
  → hydrate Nest (/users/me or bootstrap)
  → resolvePostAuthDestination({ flow: 'signin' })
  → MainTabs when email verified + Nest user present
```

`isSignedIn` for the app is true only when Nest `apiUser` is hydrated. A Supabase session alone is not enough to enter MainTabs.

---

## Account suspended

A valid Supabase session is not Mawahib access. Nest reads `users.account_status` on every authenticated request. `SUSPENDED` returns HTTP 403 with `code: ACCOUNT_SUSPENDED`. That is not a 401, so the app does not refresh or sign the user out.

The app keeps the Supabase session and shows only **Account suspended**. Check again runs the normal `/users/me` hydration once. Log out uses `signOut({ scope: 'local' })`. Forgot Password stays available after logout because it talks to Supabase, not Nest. Signing in again while the row is still `SUSPENDED` returns to the same screen. Change Password stays inside Settings and is not reachable from the suspended screen.

The phrase “reach out to support” opens `mailto:support@mawahib.io`. It is not a ticket form, and the link does not attach the session, user id, or account status. If the device cannot open a mail app, the screen shows that the address is `support@mawahib.io` and does not claim a request was sent.

Dev-only status change, on a local database, for a known test user:

```sql
UPDATE users
SET account_status = 'SUSPENDED'
WHERE id = '<dev-user-uuid>';
```

Restore with `'ACTIVE'`. There is no admin endpoint.

Accepted limits: a request that already passed the check may finish, and a signed upload or read URL issued before suspension works until it expires. New upload sessions are blocked with the rest of the API. Public profile hiding, audit history, and admin writes are later work.

---

## Backend unavailable (Supabase OK, Nest down)

If OTP or sign-in succeeds and a Supabase session exists, but `/users/me` or `/auth/bootstrap` fails (network, Nest down, temporary 5xx):

- This is **not** an OTP failure.
- Supabase session is **kept** (except HTTP 401, which signs out).
- Nest identity is cleared (`apiUser = null`); app `isSignedIn` stays false.
- **MainTabs stays blocked** until Nest hydrate succeeds.
- Sign-in can show a truthful banner and **Retry profile load** (`bootstrapSession`).

Concurrent hydrate/bootstrap calls coalesce: later signup overrides (account type, phone, location, etc.) merge into the in-flight work so required bootstrap metadata is not silently dropped.

---

## Identity binding (Nest)

| Field | Rule |
|-------|------|
| Canonical email | From trusted Supabase Auth / JWT — client cannot redefine authenticated email to another address |
| `email_verified` | Synced from Supabase Auth admin (`email_confirmed_at`) |
| `phone_e164` | Client-supplied, validated E.164 |
| `phone_verified` | Synced from Auth **only when** Auth’s confirmed phone **exactly equals** Nest `phone_e164` |
| Phone change | Clears Nest `phone_verified` until the new number is confirmed in Auth |

Clients must not send forgeable `emailVerified` / `phoneVerified` on bootstrap or `PATCH /users/me`.

`accountType` (`talent` | `business`) is chosen on Join Mawahib / signup and sent at bootstrap. Nest stores it on create and does **not** change it on re-bootstrap.

---

## Phone number picker (signup)

The signup phone country selector supports **only**:

| Country | Flag | Dial code |
|---------|------|-----------|
| Saudi Arabia | 🇸🇦 | +966 |
| United Arab Emirates | 🇦🇪 | +971 |

Other countries were intentionally removed for MVP. National rules remain: Saudi / UAE mobile `5XXXXXXXX` (9 digits) → E.164 `+9665…` / `+9715…`.

---

## Default avatar

New profiles start with `avatarUrl = null` (Nest). The app does **not** upload or store a default image per user.

Frontend `UserAvatar`:

- null / empty / failed image load → circular Mawahib pink background **`#F6339A`** + white person silhouette
- a real uploaded URL replaces the fallback

---

## MainTabsGate

`MainTabsGate` (root navigator) renders MainTabs only when **all** are true:

1. Supabase session present (via AuthContext)
2. Nest `apiUser` hydrated (`isSignedIn` for the app requires Nest user)
3. `emailVerified === true` on the Nest user

Otherwise the user is redirected to SignIn / ConfirmCode via `resolvePostAuthDestination` — never into MainTabs with an unverified or Nest-missing identity.

---

## Post-auth gate

All Auth success paths use `resolvePostAuthDestination` (`src/lib/postAuthGate.ts`):

1. Email not verified → ConfirmCode  
2. Fresh verify / deep-link (`flow: 'verify' | 'deeplink'`) + phone present but unverified → VerifyAccount (Skip allowed)  
3. Otherwise fresh verify → TurnOnNotifications  
4. Sign-in / session restore with verified email + Nest user → MainTabs  

Covered paths: OTP verify, deep-link session, password sign-in, splash restore, signup `session_ready`.

---

## Phone OTP (optional, feature-flagged — currently OFF)

```text
Authenticated + email-verified user
  → updateUser({ phone })
  → SMS OTP (requires Supabase phone provider)
  → verifyOtp({ type: 'phone_change' })
  → Nest syncs phone_verified only when phones match
```

- Same Supabase user (no second Auth identity).
- Enable only with `EXPO_PUBLIC_PHONE_AUTH_ENABLED=true` after SMS works.
- Skipping phone does **not** block entering Mawahib.
- Architecture is secured for identity binding even while the feature flag is off.

---

## Forgot password and change password

Password recovery in the app is an email OTP. While this app holds a recovery lock, it stays on the recovery flow and does not enter the product. The lock blocks that app instance's product calls. It is an app restriction, not a server-enforced recovery-session boundary, and it does not prevent a direct API request.

### Accepted recovery-session policy

For an active account, the hosted six-digit recovery flow's valid OTP session may access ordinary private Mawahib APIs. Existing account-status, ownership, participation, and authorization checks still apply.

This is not a claim that every recovery session is admitted, or that every recovery session is rejected.

- The observed signup verification session and the observed six-digit recovery-code session both carried authentication method `otp`.
- The backend cannot treat every OTP token as recovery. That would affect legitimate signup.
- Tokens that explicitly carry authentication method `recovery` remain rejected.
- The hosted recovery OTP session is admitted under this policy. The live check demonstrated `GET /users/me` before and after one refresh. Other private capabilities were inferred from source and were not exercised.
- No additional recovery classifier is being introduced.

Someone who controls the recovery inbox can use that verified session before changing the password. This allows a less visible period of account access while the original password and other sessions may remain usable. Mailbox control does not eliminate that risk.

This acceptance applies to the current feature scope. Real payments, payouts, bank-detail changes, account deletion, and other high-impact capabilities require a separate assessment of server-enforced reauthentication or step-up controls before launch. That assessment has to include recovery users and the authentication methods the product supports. It does not assume one factor is universal.

The accepted access-token lifetime is 3600 seconds. Revoking a refresh session does not invalidate an access token that was already issued. Nest does not look up the provider session on each request. Secure email change is enabled. Secure password change, the separate reauthentication control, remains disabled.

```text
Sign In → Forgot password?
  → local sign-out if a session already exists
  → resetPasswordForEmail(email) with no redirectTo
  → neutral result (does not reveal whether the account exists)
  → 6-digit code
  → persist recovery phase "verifying" BEFORE verifyOtp
  → verifyOtp({ type: 'recovery' })
  → PASSWORD_RECOVERY does not hydrate Nest
  → phase "recovery-session" only if the session email matches
  → Reset Password
  → updateUser({ password }) after rechecking user id and email
  → signOut({ scope: 'global' })
  → clear the recovery lock only after sign-out succeeds
  → Sign In
```

While this app has `verifying` or `recovery-session` stored, it follows the rules below. These are app rules. They do not mean the server rejects the hosted recovery OTP session:

- do not call `/users/me` or `/auth/bootstrap`
- do not treat `SIGNED_IN` or `TOKEN_REFRESHED` as app entry
- do not open MainTabs, VerifyAccount, or TurnOnNotifications

An interrupted recovery is discarded on the next launch: local sign-out, then clear the lock only if that sign-out succeeds. The stored recovery session is not resumed into the app.

Change Password is a real Settings row:

- current password is checked with `signInWithPassword` for the signed-in account's own email
- the returned user id must match
- the signed-in update calls `updateUser({ password, current_password })`
- recovery completion calls `updateUser({ password })` and does not send the old password
- `signOut({ scope: 'others' })` asks the provider to end other refresh sessions
- this device stays signed in
- if that other-session call fails, the password change still succeeded. The screen offers one retry of only `signOut({ scope: 'others' })` for that same session. A newer sign-in, including to the same account, does not keep the retry. It does not send the password again. A failed retry stops there
- Require current password when updating is enabled. Secure password change remains the separate control, and it is off. The app does not collect its reauthentication code
- A hosted password session that omitted `current_password` was rejected with `current_password_required`. An incorrect `current_password` was rejected with `current_password_invalid`, and the existing password still worked. A correct signed-in update then succeeded, followed by a successful other-session sign-out. That success used the app's call sequence, not taps through the screen
- With the requirement enabled, the tested six-digit recovery session still updated the password through `updateUser({ password })` only. Its method was `otp`. Global sign-out and a later sign-in both succeeded. This is one hosted recovery observation. It does not show that every OTP, magic-link, phone, or future provider session is exempt. The accepted recovery-admission policy is unchanged, and the app recovery lock remains a navigation restriction

Nest does not store or change passwords. Existing access tokens can keep working until they expire.

Supabase Dashboard prerequisite: Authentication → Email Templates → Reset Password must include `{{ .Token }}` and must not rely only on `{{ .ConfirmationURL }}`.

---

## What is NOT available in the app UI

| Control / flow | Status |
|----------------|--------|
| Social / OAuth (Google, Apple, Facebook) | **Not implemented.** Buttons are **hidden**. Do not document as available. |
| Phone SMS OTP in production | **Disabled** until provider + flag (see above). |

Do not ship dead or placeholder Auth controls.

---

## Known deferred (not fixed)

| Item | Current | Future |
|------|---------|--------|
| Visitor profile privacy | Some Nest user DTO responses (e.g. `GET /users/:userId`) may include email / phone | Separate private vs public profile DTOs |
| Avatar URL hardening | `avatarUrl` accepts validated URL strings | Restrict to approved Storage / media pipeline sources |

Do **not** treat these as completed.

---

## Auth validation record (MVP freeze)

**Implemented / code-validated**

- OTP honesty (`lastOtpRequestedAt` only after real send/resend)
- Duplicate email handling (`already_verified` / `ambiguous`)
- Supabase ↔ Nest identity binding (F2/F3)
- Session handling + Nest hydrate coalesce (F4)
- Nest-down after Supabase success (F5)
- Deep-link gate (F6)
- MainTabsGate + `resolvePostAuthDestination`
- FE: `tsc`, `scripts/auth-selftest.mjs`, `scripts/avatar-selftest.mjs`
- BE: Nest unit tests for bootstrap / F2 / F3

**Developer manually tested (B1–B18 family)**

- Talent and Business signup
- Email OTP delivery / verify / resend
- Abandoned signup resume
- Unverified login recovery
- Logout / restart / session restore
- Nest unavailable + retry paths (as exercised in local Auth work)

**Not independently re-run in the freeze audit session**

- Railway deployment end-to-end
- External Resend inbox delivery from a fresh auditor run
- Physical device testing

---

## Resend / expiry

- ConfirmCode: cooldown (`Resend code in MM:SS` → `Resend code`).
- Successful resend stamps `lastOtpRequestedAt`.
- Provider rate limits surface as user-facing errors (no insecure bypass).
- Expired / invalid OTP: clear feedback; user can resend when cooldown allows.

---

## Local vs Railway

| Concern | Depends on |
|---------|------------|
| Email OTP send / verify | Expo ↔ Supabase only |
| Nest bootstrap / `/users/me` | Nest API (`start:local` or `start:railway`) |

Email OTP must **never** require Railway.

Physical device + local Nest: phone `localhost` is not your Mac — use LAN IP or tunnel in `EXPO_PUBLIC_API_URL`. Prefer `npm run start:local` for Mac simulators. For hosted Nest validation use `npm run start:railway` (see [`API_ENV.md`](./API_ENV.md)).

---

## Env

```text
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
EXPO_PUBLIC_API_URL=...          # Nest — not used for OTP itself
EXPO_PUBLIC_PHONE_AUTH_ENABLED=false
```

---

## Supabase Dashboard — manual steps (required for OTP emails)

### 1) URL Configuration

**Authentication → URL Configuration**

- **Site URL**: app / marketing URL — **not** Nest `http://localhost:3000`
- **Redirect URLs** (fallback / deep link only):

```text
mawahib://auth/callback
mawahib://**
exp://**
```

### 2) Confirm signup template → OTP token

**Authentication → Email Templates → Confirm signup**

- **Subject (recommended):** `Your Mawahib verification code`
- **Body (minimal):**

```html
<h2>Confirm your email</h2>
<p>Your Mawahib verification code is:</p>
<p style="font-size:24px;letter-spacing:4px;"><strong>{{ .Token }}</strong></p>
<p>Enter this code in the app. This code expires soon.</p>
```

Do **not** rely on `{{ .ConfirmationURL }}` for the primary signup experience.

Also check **Authentication → Providers → Email** / OTP expiry settings (default ~1 hour is typical).

### 3) Password policy

Align with app rules: min 8, upper, lower, digit, symbol.

### 4) Phone / SMS (when enabling optional phone OTP)

**Authentication → Providers → Phone**

Recommended MVP: **Twilio**

1. Twilio Account SID + Auth Token (server-side / Supabase dashboard only — never in Expo env)
2. Messaging Service SID or From number
3. Enable Phone provider in Supabase
4. Test E.164 (`+9665…`, UAE mobiles)
5. Set `EXPO_PUBLIC_PHONE_AUTH_ENABLED=true`

### 5) Custom SMTP (before external Beta / Production)

Default Supabase email is fine for local Auth work. Before Beta/Production, configure Custom SMTP with a branded sender such as `Mawahib <no-reply@…>`.

Password-recovery email delivery uses the Reset Password template (`{{ .Token }}`). OAuth provider dashboard setup remains **out of scope**.

---

## SDK note (`verifyOtp`)

Installed `@supabase/supabase-js` (auth-js ~2.112):

- **Verify signup email OTP:** `type: 'email'`
- **Resend signup email:** `resend({ type: 'signup' })`
- **Verify password-recovery OTP:** `type: 'recovery'`
- **Request a recovery code:** `resetPasswordForEmail(email)` with no `redirectTo` (`resend()` has no recovery type)

---

## Related

- Frontend status pointer: [`STATUS.md`](./STATUS.md)
- Seed / pre-confirmed users: `mawahib-backend/docs/DEV_SEED.md`
- Architecture overview: `mawahib-backend/docs/ARCHITECTURE.md`
