# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm ci
   ```

2. Create the local environment file

   ```bash
   cp .env.example .env.local
   ```

3. Add these public client values to `.env.local`:

   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=
   ```

   `EXPO_PUBLIC_` values are embedded in the application bundle. Never use a
   Supabase service-role/secret key or another private credential here.

4. Start the installed development build

   ```bash
   npx expo start --dev-client --tunnel -c
   ```

NOXA uses native Mapbox and location modules, so runtime verification requires
an Android/iOS development build rather than Expo Go.

The EAS build profiles explicitly use their matching environments:
`development`, `preview`, and `production`.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
