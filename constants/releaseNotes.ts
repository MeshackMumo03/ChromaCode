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
    version: '2.77',
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

/** Compares dot-separated version strings, e.g. "2.9" < "2.10". */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Returns the note for an exact version match, or otherwise the most recent
 * documented note at or before the given version (since the auto-incrementing
 * version can drift past whatever version an entry was originally written
 * for). Falls back to a generic message if no note applies yet.
 */
export function getReleaseNote(version: string): ReleaseNote {
  const exact = RELEASE_NOTES.find((note) => note.version === version);
  if (exact) return exact;

  const applicable = RELEASE_NOTES
    .filter((note) => compareVersions(note.version, version) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version))[0];

  return applicable ?? { version, bullets: FALLBACK_BULLETS };
}
