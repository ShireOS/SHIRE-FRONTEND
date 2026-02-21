# Supabase Auth Setup (Publishable Key + PKCE)

This project now uses the modern browser client setup:

- `@supabase/supabase-js` `v2.95.3`
- Publishable key env var (`VITE_SUPABASE_PUBLISHABLE_KEY`)
- PKCE auth flow (`flowType: 'pkce'`)
- SDK URL session detection (`detectSessionInUrl: true`)

## Required Environment Variables

Set these in each environment used by the dashboard app:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

Do not use `VITE_SUPABASE_ANON_KEY` anymore.

## Supabase Dashboard URL Configuration

In Supabase Dashboard, configure both Site URL and Redirect URLs so auth links can return to the dashboard app.

Recommended local redirects:

- `http://localhost:5173/dashboard/auth/callback`
- `http://localhost:5173/dashboard/auth/reset-password`

Recommended production redirects:

- `https://<your-domain>/dashboard/auth/callback`
- `https://<your-domain>/dashboard/auth/reset-password`

If you use preview deployments, add their callback/reset URLs too.

## PKCE Callback Expectations

- OAuth sign-in returns to `/dashboard/auth/callback` with a `code` parameter.
- The Supabase SDK handles code/session detection automatically.
- Callback page still verifies `token_hash` email-link flows (`recovery`, `invite`, `email_change`, `email`).
- Legacy email link types (`signup`, `magiclink`) are normalized to `email` for compatibility.

## Verification Checklist

1. `npm run build` succeeds.
2. Email/password sign-in works.
3. Google OAuth sign-in returns to `/dashboard/auth/callback` and lands authenticated.
4. Password reset email flow completes.
5. Invite/email-change links validate correctly.
6. Refreshing the app keeps the user signed in.

## Troubleshooting

### Missing env var error at startup

If you see a Supabase env var error in the browser console, verify:

- `VITE_SUPABASE_URL` is set.
- `VITE_SUPABASE_PUBLISHABLE_KEY` is set.
- Dev server was restarted after env changes.

### OAuth returns to login unexpectedly

Check:

- Redirect URLs in Supabase match the exact callback path and domain.
- Your deployment base path includes `/dashboard`.
- Browser is not blocking third-party cookies/storage for your auth provider flow.

### Email reset/invite link fails

Check:

- `token_hash` and `type` parameters are present in callback URL.
- Redirect URL in Supabase includes `/dashboard/auth/callback`.

## Rollback Notes

If you must roll back quickly:

1. Revert frontend to pre-migration commit.
2. Reinstall previous Supabase SDK version.
3. Restore prior env var wiring.
4. Keep current Supabase redirect URLs; they are backward-compatible with older callback handling.

## What You Need To Do After This Change

1. Set `VITE_SUPABASE_PUBLISHABLE_KEY` in local and deployed environments.
2. Remove `VITE_SUPABASE_ANON_KEY` from env managers after validation.
3. Validate password, Google OAuth, and reset-password flows in production.
4. Monitor auth callback failures and token refresh behavior for at least 24 hours after deploy.
