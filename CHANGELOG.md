# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- `vendor/sqlcipher-amalgamation/LICENSE`: the SQLCipher license now ships with the vendored amalgamation, and `npm run sqlcipher:prepare` copies it on every refresh. The README lists the third-party code and the notice an app must reproduce when it ships the native module.
- `CHANGELOG.md`, `CONTRIBUTING.md` and `RELEASE.md`.
- `prepublishOnly` runs the tests: `npm publish` is aborted when a test fails.

### Changed

- `applySecurityPragmas` and `openEncryptedDatabase` validate `kdfIter` (positive integer) and `journalMode` (one of the documented modes) at runtime, and throw before anything is sent to the database. Values allowed by the TypeScript types are unaffected.

## 0.2.0 - 2026-10-30

First public release on npm.

### Added

- `openEncryptedDatabase`, `closeDatabase`, `runMigrations`, `isCipherAvailable`, `applySecurityPragmas`, `assertCipherAvailable`, `assertEncryptionActive`, `getSqlcipherDatabaseCtor`, `resolveSqlcipherBindingPath` and `createSqlcipherDatabaseCtor`.
- Build scripts that compile the host app's `better-sqlite3` with the vendored SQLCipher amalgamation for Electron, and a runtime check run after each build.
- Best effort bootstrap on `postinstall`, and a strict mode (`npm run sqlcipher:bootstrap:strict`).
- Signature check of the SQLCipher release tag against a pinned key when the amalgamation is regenerated.

### Requirements

- SQLCipher 4.20.0 (SQLite 3.54.1), `better-sqlite3` ^13.0.3, Electron 45, Node.js 22.14 or later.
