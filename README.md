# ChromaCode

Your secret language, simplified.

ChromaCode is a mobile messaging app built around colour codes. Each code (Code Gold, Code Navy, Code Key and so on) stands for a feeling or a need, so friends can say how they are with a single tap. It also has full chats, with groups, photos, videos and documents.

The app is built with Expo and React Native. The backend is a Node.js API with Socket.IO for live messaging.

## Features

- **Colour codes.** Send a code to a friend from the Chroma tab, keep a personal library of codes, and create or edit your own.
- **History.** See every code you have sent and received, grouped by day.
- **Chats.** One-to-one and group conversations, with live delivery, typing indicators, reactions, and image, video and document attachments.
- **Push notifications.** New messages arrive even when the app is closed. Tapping a notification opens that chat.
- **Friends and privacy.** Find friends by username, block users, and delete your account along with all its messages, files and history.
- **Accounts.** Email sign-up with verification codes, password reset, and Google sign-in.
- **Profiles.** Profile picture, banner and display details.
- **Over-the-air updates.** Fixes reach installed apps through EAS Update without a new download.

## Tech stack

| Part | Built with |
| --- | --- |
| Mobile app | Expo SDK 57, React Native, expo-router, TypeScript |
| API | Node.js 18.11 or later, Express 5, Mongoose 9 |
| Live messaging | Socket.IO |
| Database | MongoDB Atlas |
| File storage | Cloudinary |
| Email | Brevo |
| Push notifications | Expo push service |
| Builds and updates | EAS Build and EAS Update |
| Hosting | Render (API) |

## Project layout

```
app/            Screens, using file-based routing (expo-router)
  (auth)/       Login, register, email verification, password reset
  (tabs)/       Home, History, Conversations, Chroma, Profile
  chat/         A single conversation
components/     Shared UI components
hooks/          Auth, sockets, conversations, codes, history, notifications
constants/      API URL, colour codes, theme, version and release notes
utils/          File upload helper
backend/
  src/
    controllers/  Request handlers
    models/       Mongoose models
    routes/       API routes
    middleware/   Auth, errors, rate limits
    config/       Cloudinary, CORS
    socket.js     Live messaging events
    server.js     App entry point
  *.test.js     Backend tests
k6-tests/       Load, stress, spike and soak tests
scripts/        Version bump, git hook setup, client-side tests
.githooks/      Pre-commit hook that bumps the app version
```

## Getting started

### Requirements

- Node.js 18.11 or later
- npm
- A MongoDB database (a free Atlas cluster works)
- A Cloudinary account for uploads
- For phone builds: an Expo account and the EAS CLI (`npm install -g eas-cli`)

### 1. Install dependencies

```bash
npm install
```

```bash
npm install --prefix backend
```

Installing also turns on the git hooks in `.githooks`.

### 2. Configure the backend

Create `backend/.env` with these variables. Never commit this file.

| Variable | What it is for |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign login tokens |
| `MESSAGE_ENCRYPTION_KEY` | 64-character hex key used to encrypt messages at rest |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `BREVO_API_KEY` | Brevo key for verification and reset emails |
| `BREVO_SENDER_EMAIL` | Address emails are sent from |
| `BREVO_SENDER_NAME` | Name emails are sent from |
| `GOOGLE_WEB_CLIENT_ID` | Google OAuth web client ID, used to verify Google sign-in |
| `GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS client ID (optional) |
| `ALLOWED_ORIGINS` | Comma-separated list of origins allowed by CORS |
| `CHROMACODE_BOT_TOKEN` | Token for the bot API (optional; the bot routes stay closed without it) |
| `PORT` | Port to listen on (defaults to 5000) |

### 3. Configure the app

The app reads these public variables at build time:

| Variable | What it is for |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Base URL of the API, ending in `/api` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth web client ID |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS client ID |

For EAS builds and updates, these are set as EAS environment variables.

### 4. Run it

Start the app and the backend together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run backend
```

```bash
npx expo start
```

Push notifications and Google sign-in need a development or preview build. They do not work in Expo Go.

## Testing

Backend tests use the built-in Node test runner:

```bash
cd backend && node --test
```

Tests that need a database are skipped unless `MONGO_TEST_URI` points at a MongoDB instance you can wipe. Never point it at the production database.

Lint the app:

```bash
npm run lint
```

Load tests in `k6-tests/` run with [k6](https://k6.io), for example:

```bash
k6 run k6-tests/smoke-test.js
```

## Builds and releases

Builds are made with EAS. The profiles are in `eas.json`:

- `development`: development client for local work
- `preview`: internal APK on the `preview` channel, pointing at the live API
- `production`: store build on the `production` channel

```bash
eas build --profile preview --platform android
```

JavaScript-only changes ship as over-the-air updates:

```bash
eas update --branch preview --environment preview --message "Describe the change"
```

An update only reaches builds with the same `runtimeVersion` (set in `app.config.js`). Changes to native code, such as adding a native module, need a new build and a new runtime version.

### Versioning

The pre-commit hook bumps the app version on every commit (`scripts/bump-version.js`). To show users what changed, add an entry to `constants/releaseNotes.ts`.

## Deployment

The API runs on Render and deploys automatically from the `v1` branch. Set the same variables as `backend/.env` in the Render dashboard. On the free plan the server sleeps when idle, so the first request after a quiet period can take up to a minute.

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.
