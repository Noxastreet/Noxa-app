# NOXA — Architecture

## Stack

- React Native `0.81.5`
- Expo SDK `54`
- Expo Router `6`
- React `19.1`
- TypeScript `5.9`
- Supabase JS `2.109`
- RNMapbox `10.3`
- Expo Location and Task Manager
- React Native Reanimated
- React Native Gesture Handler
- EAS development, preview and production profiles
- GitHub Actions quality checks

## Runtime contract

Mapbox and location behavior require native modules. Expo Go is not accepted as proof of runtime correctness.

```bash
npm ci
cp .env.example .env.local
npx expo start --dev-client --tunnel -c
```

Only public client values may use `EXPO_PUBLIC_*`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=
```

Never place service-role keys, provider secrets or server credentials in client environment variables or the repository.

## Authentication

- Supabase owns the authentication session.
- Supported flows: email/password, Google OAuth and Apple Sign in on iOS.
- Redirect scheme: `noxa://auth/callback`.
- Provider secrets remain outside the repository.

## Maps and routing

- RNMapbox renders the map.
- Route line and Follow remain inside NOXA.
- Drivers, Events and Car Meets use floating map cards.
- Map, GPS, Route, Follow and Live Drive are runtime P0 systems.

## Backend

Supabase provides Auth, PostgreSQL, Storage and Edge Functions.

Production database changes are separate from code merge. A migration file in `main` does not prove that production was migrated. Dangerous production changes require:

1. a manual backup or database dump;
2. a verified rollback procedure;
3. explicit approval;
4. post-deployment validation.

## Engineering workflow

- Significant work uses a dedicated branch.
- Keep scope minimal and reversible.
- Record validation and known limitations in the pull request.
- Do not force-push to `main`.
- Do not merge with unresolved conflicts or failed required checks.
- A branch or pull request is not part of the product until merged.
- Preserve rollback branches until an explicit cleanup decision.
