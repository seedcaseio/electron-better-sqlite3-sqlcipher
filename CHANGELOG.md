# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## 0.3.0 - 2026-11-03

### Changed

- **Breaking:** `applySecurityPragmas` and `openEncryptedDatabase` reject a passphrase containing a NUL character (it cut the `PRAGMA key` statement short, and the resulting SQLite error quoted the start of the passphrase) or written in SQLCipher's raw key syntax `x'...'` (which skipped key derivation). The error messages never include the passphrase. A database created with such a passphrase no longer opens: change its key with an earlier version first (`PRAGMA rekey`).

## 0.2.1 - 2026-11-01

### Added

- `vendor/sqlcipher-amalgamation/LICENSE`: the SQLCipher license now ships with the vendored amalgamation, and `npm run sqlcipher:prepare` copies it on every refresh. The README lists the third-party code and the notice an app must reproduce when it ships the native module.
- `CHANGELOG.md`, `CONTRIBUTING.md` and `RELEASE.md`.
- `prepublishOnly` runs the tests: `npm publish` is aborted when a test fails.

### Changed

- `applySecurityPragmas` and `openEncryptedDatabase` validate `kdfIter` (positive integer) and `journalMode` (one of the documented modes) at runtime, and throw before anything is sent to the database. Values allowed by the TypeScript types are unaffected.
- The package no longer ships the declaration source map (`dist/index.d.ts.map`), which pointed to sources that are not published, and `npm run build` now removes stale build files first.

## 0.2.0 - 2026-10-30

First public release on npm.

### Added

- `openEncryptedDatabase`, `closeDatabase`, `runMigrations`, `isCipherAvailable`, `applySecurityPragmas`, `assertCipherAvailable`, `assertEncryptionActive`, `getSqlcipherDatabaseCtor`, `resolveSqlcipherBindingPath` and `createSqlcipherDatabaseCtor`.
- Build scripts that compile the host app's `better-sqlite3` with the vendored SQLCipher amalgamation for Electron, and a runtime check run after each build.
- Best effort bootstrap on `postinstall`, and a strict mode (`npm run sqlcipher:bootstrap:strict`).
- Signature check of the SQLCipher release tag against a pinned key when the amalgamation is regenerated.

### Requirements

- SQLCipher 4.20.0 (SQLite 3.54.1), `better-sqlite3` ^13.0.3, Electron 45, Node.js 22.14 or later.
