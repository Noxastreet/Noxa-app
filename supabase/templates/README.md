# NOXA Auth email setup

These hosted Auth settings are not database migrations. Keep this file in sync with the
production Supabase project and never commit SMTP passwords, secret keys, or service-role keys.

## Email provider

In **Authentication → Sign In / Providers → Email**:

- Email provider: enabled
- Confirm email: enabled

With Confirm email enabled, a new email/password signup should return a user but no authenticated
session until the address is confirmed. NOXA's signup UI and callback flow are built for that
behavior.

## URL configuration

In **Authentication → URL Configuration**:

- Site URL: `https://noxastreetapp.com`
- Production/development-build redirect: `noxa://auth/callback`
- Password-recovery redirect: `noxa://reset-password`
- Expo development-only redirect: `exp://**/--/auth/callback`
- Expo password-recovery redirect: `exp://**/--/reset-password`

The app passes the exact production deep links above to Supabase. Keep those exact URLs in the
allow-list. If a requested redirect is not allow-listed, Supabase can fall back to the Site URL.

## Custom SMTP

Production email must use custom SMTP so confirmation and password-recovery messages can be sent
to users outside the Supabase project team.

Expected NOXA production values:

- Sender name: `NOXA`
- Sender email: `support@noxastreetapp.com`
- SMTP host: `smtp-gr.securemail.pro`
- Port: `587`
- Username: `support@noxastreetapp.com`
- Password: stored only in the Supabase Dashboard
- Minimum interval per user: `60 seconds`

Also verify the NOXA sending domain's SPF, DKIM and DMARC records with the mail provider. Disable
provider-side email link tracking if it rewrites Supabase confirmation or recovery URLs.

Current hosted-project guidance:

- Custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Email templates: https://supabase.com/docs/guides/auth/auth-email-templates

## Confirm signup template

In **Authentication → Email Templates → Confirm signup**:

- Subject: `Confirm your NOXA account`
- Body: copy `supabase/templates/confirmation.html`

The template must keep `{{ .ConfirmationURL }}` so Supabase verifies the token and preserves the
allow-listed `emailRedirectTo` supplied by the app.

## Reset password template

In **Authentication → Email Templates → Reset password**:

- Subject: `Reset your NOXA password`
- Body: copy `supabase/templates/recovery.html`

The recovery template also keeps `{{ .ConfirmationURL }}`. The app supplies
`noxa://reset-password` as the recovery redirect and creates the recovery session after the deep
link returns to NOXA.

## Runtime acceptance

Do not mark Auth verified from static checks alone. Before release, validate on a physical iPhone:

1. Register → confirmation email → Confirm → NOXA opens → authenticated session.
2. Attempt sign-in before confirmation → blocked → resend confirmation works after cooldown.
3. Forgot password → recovery email → NOXA opens → set new password → signed out → new password signs in.
4. Google and Apple sign-in still complete normally.
5. Repeat relevant flows after app background/foreground and cold start.
