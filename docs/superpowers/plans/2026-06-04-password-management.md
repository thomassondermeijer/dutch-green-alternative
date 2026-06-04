# Password Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add forgot-password reset (logged-out) and in-account change-password (logged-in) to the Next.js + Supabase storefront.

**Architecture:** Two new `auth-context` functions wrap Supabase `resetPasswordForEmail` and `updateUser({ password })`. The recovery email redirects through the existing `/auth/callback` PKCE handler (via a `next` query param) to a new reset-password page. A new Settings view in the account dashboard hosts change-password. All pages reuse existing `account.module.css` styles and the i18n dictionary system.

**Tech Stack:** Next.js App Router (RSC + client components), `@supabase/ssr`, TypeScript, CSS Modules, JSON i18n dictionaries (de/nl/en).

**Note on verification:** This project has **no test framework** (only `next build` for typechecking and `eslint`). These are Supabase auth flows that are inherently integration-level. So each code task is verified with `npx tsc --noEmit` (typecheck) + `npm run lint`, and the real end-to-end validation is the manual test plan in Task 7 — run against the production domain `https://dutchgreenalternative.nl`, NOT a Netlify deploy-preview URL (auth is origin-scoped).

---

### Task 1: Add `resetPassword` and `updatePassword` to auth-context

**Files:**
- Modify: `src/lib/auth/auth-context.tsx`

- [ ] **Step 1: Add the two functions to the `AuthContextType` type**

In `src/lib/auth/auth-context.tsx`, find the `AuthContextType` type and add two members after `sendMagicLink`:

```ts
    sendMagicLink: (email: string) => Promise<{ error: string | null }>;
    resetPassword: (email: string, locale: string) => Promise<{ error: string | null }>;
    updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
```

- [ ] **Step 2: Implement the two functions**

Immediately after the `sendMagicLink` function definition (which ends with its closing `};`), add:

```ts
    const resetPassword = async (email: string, locale: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?next=/${locale}/account/reset-password`,
        });
        return { error: error?.message || null };
    };

    const updatePassword = async (newPassword: string) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        return { error: error?.message || null };
    };
```

- [ ] **Step 3: Expose them in the provider `value`**

Find the `<AuthContext.Provider value={{ ... }}>` and add the two functions:

```tsx
        <AuthContext.Provider
            value={{ user, session, loading, signIn, signUp, signOut, sendMagicLink, resetPassword, updatePassword }}
        >
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/auth-context.tsx
git commit -m "feat(auth): add resetPassword and updatePassword to auth context

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add i18n keys to all three dictionaries

**Files:**
- Modify: `src/i18n/dictionaries/en.json`
- Modify: `src/i18n/dictionaries/de.json`
- Modify: `src/i18n/dictionaries/nl.json`

> The `Dictionary` type is the union of all three JSON shapes, so every key MUST be added to all three files or `dict.account.<key>` access fails typechecking. `forgotPassword`, `settings`, `checkSpam`, and `loginEmail` already exist and are reused.

- [ ] **Step 1: Add keys to `en.json`**

Inside the `"account": { ... }` object (e.g. after the `"tryAgain"` entry, adding a comma), add:

```json
    "forgotPasswordTitle": "Reset Your Password",
    "forgotPasswordDesc": "Enter your email and we'll send you a link to reset your password.",
    "sendResetLink": "Send Reset Link",
    "resetLinkSent": "Check your email!",
    "resetLinkSentDesc": "If an account exists for that email, we've sent a link to reset your password.",
    "resetPasswordTitle": "Choose a New Password",
    "newPassword": "New Password",
    "confirmPassword": "Confirm Password",
    "passwordMismatch": "Passwords do not match.",
    "updatePasswordButton": "Update Password",
    "passwordUpdated": "Your password has been updated.",
    "resetLinkInvalid": "This reset link is invalid or has expired. Please request a new one.",
    "changePasswordTitle": "Change Password",
    "backToLogin": "Back to login"
```

- [ ] **Step 2: Add the same keys to `de.json`** (inside its `"account"` object)

```json
    "forgotPasswordTitle": "Passwort zurücksetzen",
    "forgotPasswordDesc": "Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen deines Passworts.",
    "sendResetLink": "Link senden",
    "resetLinkSent": "Überprüfe deine E-Mails!",
    "resetLinkSentDesc": "Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir dir einen Link zum Zurücksetzen deines Passworts gesendet.",
    "resetPasswordTitle": "Neues Passwort wählen",
    "newPassword": "Neues Passwort",
    "confirmPassword": "Passwort bestätigen",
    "passwordMismatch": "Die Passwörter stimmen nicht überein.",
    "updatePasswordButton": "Passwort aktualisieren",
    "passwordUpdated": "Dein Passwort wurde aktualisiert.",
    "resetLinkInvalid": "Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
    "changePasswordTitle": "Passwort ändern",
    "backToLogin": "Zurück zur Anmeldung"
```

- [ ] **Step 3: Add the same keys to `nl.json`** (inside its `"account"` object)

```json
    "forgotPasswordTitle": "Wachtwoord opnieuw instellen",
    "forgotPasswordDesc": "Voer je e-mailadres in en we sturen je een link om je wachtwoord opnieuw in te stellen.",
    "sendResetLink": "Verstuur link",
    "resetLinkSent": "Controleer je e-mail!",
    "resetLinkSentDesc": "Als er een account bestaat voor dat e-mailadres, hebben we een link gestuurd om je wachtwoord opnieuw in te stellen.",
    "resetPasswordTitle": "Kies een nieuw wachtwoord",
    "newPassword": "Nieuw wachtwoord",
    "confirmPassword": "Bevestig wachtwoord",
    "passwordMismatch": "De wachtwoorden komen niet overeen.",
    "updatePasswordButton": "Wachtwoord bijwerken",
    "passwordUpdated": "Je wachtwoord is bijgewerkt.",
    "resetLinkInvalid": "Deze link is ongeldig of verlopen. Vraag een nieuwe aan.",
    "changePasswordTitle": "Wachtwoord wijzigen",
    "backToLogin": "Terug naar inloggen"
```

- [ ] **Step 4: Validate JSON + typecheck**

Run: `node -e "require('./src/i18n/dictionaries/en.json');require('./src/i18n/dictionaries/de.json');require('./src/i18n/dictionaries/nl.json');console.log('JSON OK')"`
Expected: `JSON OK`
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/dictionaries/en.json src/i18n/dictionaries/de.json src/i18n/dictionaries/nl.json
git commit -m "feat(i18n): add password reset/change dictionary keys

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Forgot-password page and form

**Files:**
- Create: `src/app/[locale]/account/forgot-password/page.tsx`
- Create: `src/app/[locale]/account/forgot-password/_components/ForgotPasswordForm.tsx`

- [ ] **Step 1: Create the form component**

Create `src/app/[locale]/account/forgot-password/_components/ForgotPasswordForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../../account.module.css";

type ForgotPasswordFormProps = {
    locale: Locale;
    dict: Dictionary;
};

export function ForgotPasswordForm({ locale, dict }: ForgotPasswordFormProps) {
    const { resetPassword } = useAuth();
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const result = await resetPassword(email, locale);
        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            setSent(true);
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className={styles.authPage}>
                <div className={styles.authCard}>
                    <div className={styles.magicLinkSuccess}>
                        <div className={styles.emptyIcon}>📧</div>
                        <h2 className={styles.authTitle}>{dict.account.resetLinkSent}</h2>
                        <p className={styles.magicLinkText}>{dict.account.resetLinkSentDesc}</p>
                        <p className={styles.magicLinkHint}>{dict.account.checkSpam}</p>
                        <Link className={styles.textButton} href={`/${locale}/account/login`}>
                            {dict.account.backToLogin}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard}>
                <h1 className={styles.authTitle}>{dict.account.forgotPasswordTitle}</h1>
                <form className={styles.authForm} onSubmit={handleSubmit}>
                    {error && <div className={styles.error}>{error}</div>}
                    <p className={styles.magicLinkDesc}>{dict.account.forgotPasswordDesc}</p>
                    <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="forgot-email">
                            {dict.account.loginEmail}
                        </label>
                        <input
                            className={styles.input}
                            id="forgot-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <Button variant="primary" fullWidth type="submit" disabled={loading}>
                        {loading ? dict.common.loading : dict.account.sendResetLink}
                    </Button>
                </form>
                <p className={styles.authSwitch}>
                    <Link href={`/${locale}/account/login`}>{dict.account.backToLogin}</Link>
                </p>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Create the page**

Create `src/app/[locale]/account/forgot-password/page.tsx`:

```tsx
import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import { ForgotPasswordForm } from "./_components/ForgotPasswordForm";

export default async function ForgotPasswordPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    return (
        <main>
            <Container>
                <ForgotPasswordForm locale={locale} dict={dict} />
            </Container>
        </main>
    );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run lint`
Expected: no errors in the new files.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/account/forgot-password"
git commit -m "feat(account): add forgot-password page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Add "Forgot password?" link to the login Password tab

**Files:**
- Modify: `src/app/[locale]/account/login/_components/LoginForm.tsx`

- [ ] **Step 1: Insert the link in the password form**

In `LoginForm.tsx`, find the password-login form's submit block (the one using `dict.account.loginButton`) and insert a `Link` between the password `inputGroup`'s closing `</div>` and the `<Button>`:

Find:
```tsx
                        </div>
                        <Button variant="primary" fullWidth type="submit" disabled={loading}>
                            {loading ? dict.common.loading : dict.account.loginButton}
                        </Button>
```

Replace with:
```tsx
                        </div>
                        <Link
                            href={`/${locale}/account/forgot-password`}
                            className={styles.textButton}
                            style={{ alignSelf: "flex-end" }}
                        >
                            {dict.account.forgotPassword}
                        </Link>
                        <Button variant="primary" fullWidth type="submit" disabled={loading}>
                            {loading ? dict.common.loading : dict.account.loginButton}
                        </Button>
```

(`Link` is already imported in this file.)

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/account/login/_components/LoginForm.tsx"
git commit -m "feat(account): add forgot-password link to login password tab

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Reset-password page and form

**Files:**
- Create: `src/app/[locale]/account/reset-password/page.tsx`
- Create: `src/app/[locale]/account/reset-password/_components/ResetPasswordForm.tsx`

- [ ] **Step 1: Create the form component**

Create `src/app/[locale]/account/reset-password/_components/ResetPasswordForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../../account.module.css";

type ResetPasswordFormProps = {
    locale: Locale;
    dict: Dictionary;
};

export function ResetPasswordForm({ locale, dict }: ResetPasswordFormProps) {
    const { user, loading: authLoading, updatePassword } = useAuth();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (password !== confirm) {
            setError(dict.account.passwordMismatch);
            return;
        }
        setLoading(true);
        const result = await updatePassword(password);
        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            window.location.href = `/${locale}/account`;
        }
    };

    if (authLoading) {
        return (
            <div className={styles.authPage}>
                <div className={styles.authCard}>
                    <p>{dict.common.loading}</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className={styles.authPage}>
                <div className={styles.authCard}>
                    <div className={styles.magicLinkSuccess}>
                        <div className={styles.emptyIcon}>⚠️</div>
                        <h2 className={styles.authTitle}>{dict.account.resetPasswordTitle}</h2>
                        <p className={styles.magicLinkText}>{dict.account.resetLinkInvalid}</p>
                        <Link className={styles.textButton} href={`/${locale}/account/forgot-password`}>
                            {dict.account.forgotPassword}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard}>
                <h1 className={styles.authTitle}>{dict.account.resetPasswordTitle}</h1>
                <form className={styles.authForm} onSubmit={handleSubmit}>
                    {error && <div className={styles.error}>{error}</div>}
                    <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="reset-password">
                            {dict.account.newPassword}
                        </label>
                        <input
                            className={styles.input}
                            id="reset-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            autoFocus
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="reset-confirm">
                            {dict.account.confirmPassword}
                        </label>
                        <input
                            className={styles.input}
                            id="reset-confirm"
                            type="password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>
                    <Button variant="primary" fullWidth type="submit" disabled={loading}>
                        {loading ? dict.common.loading : dict.account.updatePasswordButton}
                    </Button>
                </form>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Create the page**

Create `src/app/[locale]/account/reset-password/page.tsx`:

```tsx
import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import { ResetPasswordForm } from "./_components/ResetPasswordForm";

export default async function ResetPasswordPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    return (
        <main>
            <Container>
                <ResetPasswordForm locale={locale} dict={dict} />
            </Container>
        </main>
    );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run lint`
Expected: no errors in the new files.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/account/reset-password"
git commit -m "feat(account): add reset-password page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Change-password form + dashboard Settings view

**Files:**
- Create: `src/app/[locale]/account/_components/ChangePasswordForm.tsx`
- Modify: `src/app/[locale]/account/_components/AccountDashboard.tsx`
- Modify: `src/app/[locale]/account/account.module.css`

- [ ] **Step 1: Create the change-password form**

Create `src/app/[locale]/account/_components/ChangePasswordForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button/Button";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../account.module.css";

type ChangePasswordFormProps = {
    dict: Dictionary;
};

export function ChangePasswordForm({ dict }: ChangePasswordFormProps) {
    const { updatePassword } = useAuth();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess(false);
        if (password !== confirm) {
            setError(dict.account.passwordMismatch);
            return;
        }
        setLoading(true);
        const result = await updatePassword(password);
        if (result.error) {
            setError(result.error);
        } else {
            setSuccess(true);
            setPassword("");
            setConfirm("");
        }
        setLoading(false);
    };

    return (
        <div>
            <h2 className={styles.contentTitle}>{dict.account.changePasswordTitle}</h2>
            <form className={styles.authForm} onSubmit={handleSubmit}>
                {error && <div className={styles.error}>{error}</div>}
                {success && <p className={styles.magicLinkText}>{dict.account.passwordUpdated}</p>}
                <div className={styles.inputGroup}>
                    <label className={styles.label} htmlFor="change-password">
                        {dict.account.newPassword}
                    </label>
                    <input
                        className={styles.input}
                        id="change-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                    />
                </div>
                <div className={styles.inputGroup}>
                    <label className={styles.label} htmlFor="change-confirm">
                        {dict.account.confirmPassword}
                    </label>
                    <input
                        className={styles.input}
                        id="change-confirm"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        minLength={6}
                    />
                </div>
                <Button variant="primary" type="submit" disabled={loading}>
                    {loading ? dict.common.loading : dict.account.updatePasswordButton}
                </Button>
            </form>
        </div>
    );
}
```

- [ ] **Step 2: Add a button reset for `.sidebarLink` so nav buttons match nav links**

Append to `src/app/[locale]/account/account.module.css` (after the existing `.sidebarLink.sidebarLinkActive:hover` rule):

```css
button.sidebarLink {
    border: none;
    background: none;
    cursor: pointer;
    width: 100%;
    text-align: left;
    font-family: var(--font-body);
}
```

- [ ] **Step 3: Add the `ChangePasswordForm` import to AccountDashboard**

In `src/app/[locale]/account/_components/AccountDashboard.tsx`, add this import after the existing `Button` import:

```tsx
import { ChangePasswordForm } from "./ChangePasswordForm";
```

- [ ] **Step 4: Add a `view` state**

In `AccountDashboard`, find the existing `useState` declarations and add (next to `expandedOrder`):

```tsx
    const [view, setView] = useState<"orders" | "settings">("orders");
```

- [ ] **Step 5: Replace the sidebar nav with view-toggle buttons**

Find the existing nav block:

```tsx
                <nav className={styles.sidebarNav}>
                    <Link
                        href={`/${locale}/account`}
                        className={`${styles.sidebarLink} ${styles.sidebarLinkActive}`}
                    >
                        📋 {dict.account.orders}
                    </Link>
                    <button
                        className={styles.logoutBtn}
                        onClick={async () => {
                            await signOut();
                            window.location.href = `/${locale}`;
                        }}
                    >
                        🚪 {dict.nav.logout}
                    </button>
                </nav>
```

Replace with:

```tsx
                <nav className={styles.sidebarNav}>
                    <button
                        className={`${styles.sidebarLink} ${view === "orders" ? styles.sidebarLinkActive : ""}`}
                        onClick={() => setView("orders")}
                    >
                        📋 {dict.account.orders}
                    </button>
                    <button
                        className={`${styles.sidebarLink} ${view === "settings" ? styles.sidebarLinkActive : ""}`}
                        onClick={() => setView("settings")}
                    >
                        ⚙️ {dict.account.settings}
                    </button>
                    <button
                        className={styles.logoutBtn}
                        onClick={async () => {
                            await signOut();
                            window.location.href = `/${locale}`;
                        }}
                    >
                        🚪 {dict.nav.logout}
                    </button>
                </nav>
```

- [ ] **Step 6: Render the settings view in the content area**

In the same file, find the start of the content area:

```tsx
            {/* Content */}
            <div className={styles.content}>
                {/* Unpaid Banner */}
```

Replace those lines with a conditional that renders the change-password form for the settings view and wraps the existing orders content:

```tsx
            {/* Content */}
            <div className={styles.content}>
                {view === "settings" ? (
                    <ChangePasswordForm dict={dict} />
                ) : (
                <>
                {/* Unpaid Banner */}
```

Then find the matching closing `</div>` of the content area (the one immediately before the sidebar/content wrapper closes — it currently closes the orders content). The content `<div>` currently ends like this:

```tsx
                )}
            </div>
        </div>
    );
}
```

Replace with (close the fragment before the content div):

```tsx
                )}
                </>
                )}
            </div>
        </div>
    );
}
```

> If `Link` is no longer used anywhere else in `AccountDashboard.tsx` after Step 5, remove its import to satisfy lint. Verify with the lint step below; if it flags an unused `Link`, delete `import Link from "next/link";`. (It is still used by the order `trackingLink`/other links — check before removing.)

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run lint`
Expected: no errors (resolve any unused-import warning per the note above).

- [ ] **Step 8: Build to confirm the page compiles**

Run: `npm run build`
Expected: build completes successfully with the account route compiled.

- [ ] **Step 9: Commit**

```bash
git add "src/app/[locale]/account/_components/ChangePasswordForm.tsx" "src/app/[locale]/account/_components/AccountDashboard.tsx" "src/app/[locale]/account/account.module.css"
git commit -m "feat(account): add change-password settings view to dashboard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: End-to-end verification, Supabase config check, deploy

**Files:** none (verification + config + deploy)

- [ ] **Step 1: Confirm Supabase config**

In the Supabase dashboard:
- **Authentication → Emails:** the "Reset Password" template is enabled and SMTP (Resend) is configured.
- **Authentication → URL Configuration → Redirect URLs:** `https://dutchgreenalternative.nl/auth/callback` is present (the `?next=…` param rides on this base).
- **Site URL** = `https://dutchgreenalternative.nl`.

- [ ] **Step 2: Push and deploy**

```bash
git push origin main
```
Wait for the Netlify production deploy of `dutchgreenalternative.nl` to go green.

- [ ] **Step 3: Manual test — forgot-password flow** (on `https://dutchgreenalternative.nl`, not a deploy-preview URL)

1. Go to `/en/account/login`, open the **Password** tab, click **"Forgot Password?"**.
2. Enter your email, submit → "check your email" screen appears.
3. Open the email, click the reset link → lands on `/en/account/reset-password` showing the new-password form (logged in via recovery session).
4. Enter a new password + confirm → submit → redirected to `/en/account`, logged in.
Expected: all steps succeed.

- [ ] **Step 4: Manual test — password login with the new password**

1. Log out. Go to `/en/account/login`, **Password** tab.
2. Log in with email + the new password.
Expected: logged in, dashboard shows.

- [ ] **Step 5: Manual test — change-password flow**

1. While logged in, open the account dashboard, click **Settings** (⚙️) in the sidebar.
2. Enter a new password + confirm → submit → success message shown.
3. Log out, log in with the changed password.
Expected: all steps succeed.

- [ ] **Step 6: Manual test — edge cases**

1. Visit `/en/account/reset-password` directly (no recovery session) → "reset link invalid or expired" + link to forgot-password.
2. On reset and change forms, enter mismatched passwords → "passwords do not match" shown, no network call.
3. Spot-check the forgot-password and reset-password pages render in `de` and `nl` locales.
Expected: all behave as described.

---

## Self-Review

**Spec coverage:**
- Forgot-password reset (logged-out) → Tasks 3, 4, 5 ✓
- Change password (logged-in) → Task 6 ✓
- `resetPassword` / `updatePassword` in auth-context → Task 1 ✓
- Reuse `/auth/callback` via `next` param → Task 1 (redirectTo) + Task 7 config ✓
- i18n keys in de/nl/en → Task 2 ✓
- Reset page invalid-session guard → Task 5 (`!user` branch) ✓
- No account enumeration → Task 3 (success screen on success; Supabase doesn't reveal existence) ✓
- Styling reuse → all UI tasks use `account.module.css` ✓
- Manual test plan → Task 7 ✓

**Type consistency:** `resetPassword(email, locale)` and `updatePassword(newPassword)` signatures defined in Task 1 are used identically in Tasks 3, 5, 6. `view` state union `"orders" | "settings"` consistent in Task 6. Dictionary keys referenced in UI all added in Task 2.

**Placeholder scan:** No TBD/TODO; every code step contains full content; exact paths and commands throughout.
