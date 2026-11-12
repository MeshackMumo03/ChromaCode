# Security Policy

## Supported versions

Only the latest release gets security fixes.

| Part | Supported |
| --- | --- |
| App: the latest update on the `production` and `preview` channels | Yes |
| App: older builds that can no longer receive over-the-air updates | No, please install the latest build |
| API: the `v1` branch, deployed at chromacode.onrender.com | Yes |
| Any other branch, including `master` | No |

Most fixes reach installed apps through over-the-air updates, so users get them without reinstalling. Fixes that need native code changes ship in a new build.

## Reporting a vulnerability

Please do not report security problems in public issues, pull requests or discussions.

Report them privately through GitHub instead:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Describe the problem, the steps to reproduce it, and what an attacker could do with it.

Include the app version (shown in the app's settings) or the API endpoint involved, if you know it.

### What to expect

- An acknowledgement within 3 days.
- An assessment within 7 days, saying whether the report is accepted and how serious it is.
- For accepted reports, a fix as soon as possible. Serious problems are fixed first, usually within 14 days. You will be told when the fix ships.
- For declined reports, an explanation of why.

You are welcome to be credited in the release notes once the fix is out. Say so in your report.

## Scope

In scope:

- The ChromaCode mobile app
- The ChromaCode API and its live messaging (Socket.IO)
- How the app and API handle accounts, messages, files and personal data

Out of scope:

- Problems in third-party services the app uses (MongoDB Atlas, Cloudinary, Brevo, Expo, Google, Render). Report those to the service directly.
- Denial-of-service tests, spam, or automated scanning against the live service.
- Social engineering of users or the maintainer.

## Testing safely

When testing, use only accounts you own. Do not read, change or delete other people's data, and stop as soon as you have shown a problem exists. Testing done in good faith under these rules will not be treated as an attack.
