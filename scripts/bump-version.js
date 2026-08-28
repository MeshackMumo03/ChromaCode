#!/usr/bin/env node

/**
 * Bumps the app's patch version (last dot-separated segment) across the
 * files that need to stay in sync:
 *   - package.json          ("version" field, single source of truth)
 *   - app.config.js         ("version" field used for the native/EAS build)
 *   - constants/version.ts  (APP_VERSION, used for the in-app version footer)
 *
 * Intentionally does NOT touch app/_layout.tsx's one-time "we're back" toast
 * version marker — that is a separate, independent release-notice key and
 * bumping it here would cause that toast to re-fire on every commit.
 *
 * Usage: node scripts/bump-version.js
 * Exits with code 0 and prints nothing if there is nothing to bump (e.g.
 * package.json is missing), so it's safe to call from a git hook.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const appConfigPath = path.join(root, 'app.config.js');
const versionTsPath = path.join(root, 'constants', 'version.ts');

function bumpVersionString(version) {
  const parts = version.split('.');
  const last = parseInt(parts[parts.length - 1], 10);
  parts[parts.length - 1] = String(Number.isNaN(last) ? 0 : last + 1);
  return parts.join('.');
}

function main() {
  if (!fs.existsSync(pkgPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const oldVersion = pkg.version;
  const newVersion = bumpVersionString(oldVersion);

  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  if (fs.existsSync(appConfigPath)) {
    const configSrc = fs.readFileSync(appConfigPath, 'utf8');
    const updatedConfig = configSrc.replace(
      /"version":\s*"[^"]*"/,
      `"version": "${newVersion}"`,
    );
    fs.writeFileSync(appConfigPath, updatedConfig);
  }

  if (fs.existsSync(versionTsPath)) {
    const versionTsSrc = fs.readFileSync(versionTsPath, 'utf8');
    const updatedVersionTs = versionTsSrc.replace(
      /APP_VERSION = '[^']*'/,
      `APP_VERSION = '${newVersion}'`,
    );
    fs.writeFileSync(versionTsPath, updatedVersionTs);
  }

  console.log(`Bumped version: ${oldVersion} -> ${newVersion}`);
}

main();
