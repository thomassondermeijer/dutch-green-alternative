# Password Management — Design

**Date:** 2026-06-04
**Status:** Approved (pending spec review)

## Problem

The app supports magic-link login (passwordless) and password login, but has **no way to reset a forgotten password or set/change a password**. Users who sign in via magic link have no password at all, and locked-out users have no recovery path inside the app. The only current workaround is the Supabase dashboard (owner-only).

## Goals

1. **Forgot-password reset** — a logged-out user can request a reset email and choose a new password.
2. **Change password** — a logged-in user can set or change their password from the account dashboard.

Magic-link and password login both remain unchanged. Nothing is removed.

## Non-goals

- Localizing the recovery **email body** (it's a Supabase dashboard template, not app-controlled — same limitation as today's magic-link email). Only the in-app pages are localized.
- Requiring the current password before changing it (decided: no re-auth — most users are passwordless and have no current password to enter; the active session authorizes the change, which is standard Supabase behavior).
- Any change to registration or the existing login flows beyond adding one "Forgot password?" link.

## Architecture

### Reset-link handling (key decision)

`resetPasswordForEmail` sends a recovery email whose link carries a `?code=`. We **reuse the existing `/auth/callback` route** (the PKCE code-exchange handler we recently fixed) rather than building a second exchange path:

```
redirectTo = ${origin}/auth/callback?next=/<locale>/account/reset-password
```

Flow:
1. `/auth/callback` reads `code`, calls `exchangeCodeForSession`, sets the session cookie.
2. It redirects to its `next` param → the reset-password page.
3. The reset-password page sees an active (recovery) session and shows the new-password form.

This adds zero new code-exchange logic and is identical to the working magic-link path.

### Components

**`src/lib/auth/auth-context.tsx`** — two new functions, mirroring `sendMagicLink`:
- `resetPassword(email, locale)` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${window.location.origin}/auth/callback?next=/${locale}/account/reset-password\` })` → returns `{ error: string | null }`.
- `updatePassword(newPassword)` → `supabase.auth.updateUser({ password: newPassword })` → returns `{ error: string | null }`.
- Both added to `AuthContextType` and the provider `value`.

**Forgot-password page (logged-out)**
- `src/app/[locale]/account/forgot-password/page.tsx` — server page mirroring `login/page.tsx` (resolves locale + dict, renders the client form in a `Container`).
- `src/app/[locale]/account/forgot-password/_components/ForgotPasswordForm.tsx` — email input → `resetPassword(email, locale)` → on success show a "check your email" confirmation (reuses the `magicLinkSent`-style success UI). Always show the success state regardless of whether the email exists (avoid account enumeration). Includes a link back to login.
- **Login page wiring:** render the existing `dict.account.forgotPassword` string as a `Link` to `/<locale>/account/forgot-password` on the **Password** tab of `LoginForm.tsx`.

**Reset-password page (recovery landing)**
- `src/app/[locale]/account/reset-password/page.tsx` — server page (same pattern).
- `src/app/[locale]/account/reset-password/_components/ResetPasswordForm.tsx` — client component:
  - Reads `{ user, loading }` from `useAuth()`.
  - While `loading` → loading state.
  - If `!user` after load → "reset link invalid or expired" message + link to `/<locale>/account/forgot-password`.
  - If `user` present → **new password** + **confirm password** fields → validate non-empty, `minLength={6}`, and match → `updatePassword(newPassword)` → on success redirect to `/<locale>/account` (now logged in). On error, show it.

**Change-password (logged-in)**
- `src/app/[locale]/account/_components/ChangePasswordForm.tsx` — **new password** + **confirm password** → same validation → `updatePassword`. Shown inline success/error.
- `AccountDashboard.tsx` — add a **"Settings"** sidebar item (using the existing unused `dict.account.settings` key). Sidebar toggles a local `view` state (`"orders" | "settings"`); the content area renders either the orders list (existing) or `<ChangePasswordForm />`. Extracting the form into its own component keeps `AccountDashboard` from growing further.

### i18n

Add keys to `src/i18n/dictionaries/{de,nl,en}.json` under `account`:
- `forgotPasswordTitle`, `forgotPasswordDesc`, `sendResetLink`, `resetLinkSent`, `resetLinkSentDesc`
- `resetPasswordTitle`, `newPassword`, `confirmPassword`, `passwordMismatch`, `updatePasswordButton`, `passwordUpdated`, `resetLinkInvalid`
- `changePasswordTitle`, `backToLogin`

(`forgotPassword` and `settings` already exist and are reused.)

### Styling / UX

Reuse `account.module.css` (`authPage`, `authCard`, `authForm`, `inputGroup`, `input`, `error`, etc.) so the new pages match login/register. Password fields use `type="password"`, `minLength={6}`. Confirm-match is validated client-side before calling Supabase.

## Configuration (not code)

- Supabase **"Reset Password"** email template must be enabled (default on) and now sends via the configured Resend SMTP.
- The `/auth/callback` redirect is already on the Supabase **Redirect URLs** allowlist; the added `?next=…` query param rides on the allowlisted base path. Verify a reset round-trip works end to end on `https://dutchgreenalternative.nl`.

## Data flow summary

```
Forgot:  login → "Forgot password?" → forgot-password page
         → resetPassword(email, locale) → Supabase recovery email
         → click link → /auth/callback?code&next=/<locale>/account/reset-password
         → exchangeCodeForSession (session cookie) → redirect to reset-password page
         → new+confirm password → updatePassword → redirect to /<locale>/account (logged in)

Change:  account dashboard → Settings → ChangePasswordForm
         → new+confirm password → updatePassword → success message
```

## Error handling

- `resetPassword`: Supabase returns success even for non-existent emails (no account enumeration, by design), so on success render the "check your email" screen unconditionally. Only real errors (e.g. rate limit, network) surface inline.
- `updatePassword`: surface Supabase errors inline (e.g. weak password, expired session). On reset page with no session, never call `updatePassword` — show the invalid-link state instead.
- Confirm-mismatch and too-short password are caught client-side before any network call.

## Testing

Manual (production domain `https://dutchgreenalternative.nl`, since auth is origin-scoped — not a Netlify deploy-preview URL):
1. **Forgot flow:** request reset → receive email → click → land on reset page with session → set new password → redirected to account, logged in.
2. **Password login:** log out → log in via Password tab with the new password.
3. **Change flow:** logged in → Settings → change password → log out → log in with the changed password.
4. **Invalid reset:** visit `/<locale>/account/reset-password` directly with no session → invalid-link state shown.
5. **Mismatch/short:** confirm client-side validation blocks submit.
6. **i18n:** pages render correctly in de/nl/en.

## Files touched

New:
- `src/app/[locale]/account/forgot-password/page.tsx`
- `src/app/[locale]/account/forgot-password/_components/ForgotPasswordForm.tsx`
- `src/app/[locale]/account/reset-password/page.tsx`
- `src/app/[locale]/account/reset-password/_components/ResetPasswordForm.tsx`
- `src/app/[locale]/account/_components/ChangePasswordForm.tsx`

Modified:
- `src/lib/auth/auth-context.tsx` (add `resetPassword`, `updatePassword`)
- `src/app/[locale]/account/login/_components/LoginForm.tsx` (add "Forgot password?" link)
- `src/app/[locale]/account/_components/AccountDashboard.tsx` (add Settings view)
- `src/i18n/dictionaries/{de,nl,en}.json` (new keys)
