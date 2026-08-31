/**
 * Versioned "What's New" content, shown once per version via the Home tab's
 * update modal and mirrored on the Privacy & Release Notes screen.
 *
 * APP_VERSION (constants/version.ts) is bumped automatically on every commit
 * by the pre-commit hook, so most versions won't have a curated entry here.
 * getReleaseNote() falls back to a generic message for those so the modal
 * still shows something sensible instead of stale/missing content.
 *
 * Add a new entry here whenever a release has something worth telling users
 * about (new features, notable fixes) — otherwise the fallback is used.
 */

export interface ReleaseNote {
  version: string;
  bullets: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '2.76',
    bullets: [
      "Rebuilt uploads: profile pictures, banners, and chat media (images, videos, documents) now upload reliably.",
      "Default profile banner shown automatically until you set your own.",
      "Fixed several rendering and state-handling issues across Home, Chroma, and chat screens.",
      "The app version now updates automatically with every release.",
    ],
  },
];

const FALLBACK_BULLETS = [
  "We shipped small fixes and improvements to keep ChromaCode running smoothly.",
];

export function getReleaseNote(version: string): ReleaseNote {
  const match = RELEASE_NOTES.find((note) => note.version === version);
  return match ?? { version, bullets: FALLBACK_BULLETS };
}
