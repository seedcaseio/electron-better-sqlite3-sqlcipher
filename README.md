# @frag-ment/better-sqlite3-sqlcipher

SQLCipher-enabled adapter around `better-sqlite3`, plus helper scripts to bootstrap a working SQLCipher runtime (notably in Electron contexts).

## Role

- Provides a small typed adapter around `better-sqlite3` + SQLCipher PRAGMAs.
- Keeps native encryption concerns outside app business/UI layers.
- Makes extraction to a dedicated repository straightforward later.

## Public API

- `openEncryptedDatabase(options)`
- `closeDatabase()`
- `runMigrations(migrate)`
- `isCipherAvailable(databaseCtor?)`
- `applySecurityPragmas(db, passphrase, options?)`
- `assertCipherAvailable(db)`: throws unless the connection runs SQLCipher (`openEncryptedDatabase` already calls it).
- `getSqlcipherDatabaseCtor()`: `better-sqlite3` constructor bound to the SQLCipher build. Use it for every connection opened outside `openEncryptedDatabase`.
- `resolveSqlcipherBindingPath()`, `createSqlcipherDatabaseCtor(DatabaseModule, nativeBinding)`

## Why the SQLCipher build is loaded explicitly

`better-sqlite3` 13 ships prebuilt binaries (`prebuilds/`) built with plain SQLite, without SQLCipher. By default it skips compiling when a prebuild exists for the host, and loads the prebuild before `build/Release`. This package therefore:

- compiles with `--force_build=1 --sqlite3=<amalgamation>` (`scripts/rebuild-electron-sqlcipher.sh`);
- opens every connection with `nativeBinding` pointing at `better-sqlite3/build/Release/better_sqlite3.node`;
- `openEncryptedDatabase` refuses to open a database when `cipher_version` is empty. Connections opened with `getSqlcipherDatabaseCtor()` directly must call `assertCipherAvailable(db)` themselves.

Host apps should not ship `better-sqlite3/prebuilds/`, and should never `require('better-sqlite3')` directly to open a database.

## Install

```bash
npm i @frag-ment/better-sqlite3-sqlcipher better-sqlite3@^13
```

`better-sqlite3` is a peer dependency: the host app provides the single copy that gets rebuilt with SQLCipher.

`postinstall` tries to bootstrap automatically (best effort). If it fails, install still succeeds and you can run strict mode manually.

For deterministic local/CI setup, run strict mode manually:

```bash
npm run sqlcipher:bootstrap:strict
```

Host app resolution:

- Scripts use `FRAGMENT_APP_ROOT` (or `INIT_CWD`) to find the host app root.
- If Electron version is not found in host `package.json`, set `ELECTRON_VERSION` explicitly.

## System dependencies

Linux build dependencies are the same as the desktop app native toolchain: `build-essential`, `python`, OpenSSL dev headers and `node-gyp` compatible environment.

## Runtime versions

- Node.js: `>=22.14.0`
- `better-sqlite3`: `^13.0.3` (N-API)
- Electron host app: `45.x`
