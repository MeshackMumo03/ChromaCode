#!/usr/bin/env node

/**
 * Points this repo's git hooks path at .githooks so the auto version-bump
 * pre-commit hook is active for anyone who runs `npm install`.
 * Safe to run anywhere, including environments with no .git directory
 * (e.g. EAS build servers) — failures are silently ignored.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  const gitDir = path.join(__dirname, '..', '.git');
  if (!fs.existsSync(gitDir)) process.exit(0);

  execSync('git config core.hooksPath .githooks', {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore',
  });
} catch (e) {
  // Not a git repo, git not installed, or read-only environment — ignore.
}
