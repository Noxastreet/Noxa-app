# Google and Apple authentication setup

The app code supports Google OAuth on Android and iOS, plus native Sign in with Apple on iOS. Provider credentials are configured outside the repository and must never be committed.

## Shared Supabase configuration

- Project ref: `wzfpwuyyaotvofdijhin`
- Supabase OAuth callback: `https://wzfpwuyyaotvofdijhin.supabase.co/auth/v1/callback`
- Allowed mobile redirect: `noxa://auth/callback`
- iOS bundle identifier: `com.karaketidis.noxa`

Keep `noxa://auth/callback` in **Authentication → URL Configuration → Redirect URLs** before testing either provider.

## Google

1. In Google Auth Platform, configure the NOXA consent screen and the `openid`, email, and profile scopes.
2. Create an OAuth client of type **Web application**.
3. Add the Supabase OAuth callback above as an authorized redirect URI.
4. Enable Google in **Supabase → Authentication → Providers** and enter the Google client ID and secret there.
5. Do not place the Google client secret in Expo environment variables or source code.

## Apple

1. Join the Apple Developer Program and enable **Sign in with Apple** for App ID `com.karaketidis.noxa`.
2. Add `com.karaketidis.noxa` to the Apple provider Client IDs in Supabase and enable the provider.
3. If NOXA later adds Apple OAuth for web or Android, create a Services ID and signing key, put the Services ID first in Supabase's Client IDs, and rotate the OAuth client secret at least every six months.
4. Create a new EAS iOS development build after enabling the capability. The config plugin and `ios.usesAppleSignIn` only take effect in a newly built binary.

## Required device checks

- Android development build: Google new account, existing account, account chooser, cancel, offline error, restored session, and sign-out.
- Physical iPhone development build: the same Google cases plus Apple first sign-in, private relay email, repeated sign-in where Apple no longer returns the name, cancel, restored session, and sign-out.
- Both providers: onboarding routing, `public.profiles` display name/avatar hydration, and no overwrite of a user-edited profile.
- Small and large phones: safe areas, keyboard, text scaling, and scrolling on both sign-in and sign-up screens.

Before release, update the privacy disclosures for Google/Apple identity data and verify that social-only accounts can complete the in-app account-deletion flow.
