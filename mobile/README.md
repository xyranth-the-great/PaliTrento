# PaliTrento Mobile

This Expo / React Native app lives in `mobile/`. It has its own `package.json` and lockfile; the website continues to use the repository root package files.

## Local setup

1. From the repository root, run `cd mobile` and `npm ci`.
2. Copy `.env.example` to `.env` and set the Supabase URL and anon key. Never commit `.env`.
3. For Android builds with Firebase push notifications, put the Firebase `google-services.json` at `mobile/google-services.json`. It is intentionally ignored by Git; do not commit it.
4. Run `npx expo start` for the Expo development server. Use the commands in `HANDOFF.md` for device builds and project-specific checks.

The checked-in `android/` directory contains intentional native patches. Preserve those patches and do not run `expo prebuild --clean` without reviewing the handoff notes first. Generated Gradle output, IDE files, dependencies, local SDK paths, credentials, and backup copies are excluded from this repository.
