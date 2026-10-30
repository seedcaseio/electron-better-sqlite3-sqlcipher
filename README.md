# electron-better-sqlite3-sqlcipher

Builds `better-sqlite3` against SQLCipher for an Electron app, and provides a small typed API to open encrypted databases with the SQLCipher build.

## Role

- Compiles the host app's `better-sqlite3` with the vendored SQLCipher amalgamation (OpenSSL crypto provider).
- Provides a small typed adapter around `better-sqlite3` + SQLCipher PRAGMAs.
- Keeps native encryption concerns outside the app's business and UI layers.

## Public API

- `openEncryptedDatabase(options)`
- `closeDatabase()`
- `runMigrations(migrate)`
- `isCipherAvailable(databaseCtor?)`
- `applySecurityPragmas(db, passphrase, options?)`
- `assertCipherAvailable(db)`: throws unless the connection runs SQLCipher (`openEncryptedDatabase` already calls it).
- `assertEncryptionActive(db)`: throws unless the key attached an encrypting codec to the connection (`PRAGMA cipher_status`). `applySecurityPragmas` calls it right after the key, before any write.
- `getSqlcipherDatabaseCtor()`: `better-sqlite3` constructor bound to the SQLCipher build. Use it for every connection opened outside `openEncryptedDatabase`.
- `resolveSqlcipherBindingPath()`, `createSqlcipherDatabaseCtor(DatabaseModule, nativeBinding)`

## Why the SQLCipher build is loaded explicitly

`better-sqlite3` 13 ships prebuilt binaries (`prebuilds/`) built with plain SQLite, without SQLCipher. By default it skips compiling when a prebuild exists for the host, and loads the prebuild before `build/Release`. This package therefore:

- compiles with `--force_build=1 --sqlite3=<amalgamation>` (`scripts/rebuild-electron-sqlcipher.sh`);
- opens every connection with `nativeBinding` pointing at `better-sqlite3/build/Release/better_sqlite3.node`;
- `openEncryptedDatabase` refuses to open a database when `cipher_version` is empty. Connections opened with `getSqlcipherDatabaseCtor()` directly must call `assertCipherAvailable(db)` themselves;
- `applySecurityPragmas` enables `cipher_memory_security` before the key, unless `memorySecurity: false`. It is process-wide and can only be enabled: `false` never turns it off. Freed SQLite allocations are zeroed; locking them in RAM is best effort (beyond `RLIMIT_MEMLOCK` on Linux or the Windows working set, memory stays pageable without any error);
- `applySecurityPragmas` checks `cipher_status` right after the key and throws before any write if encryption is not active.

Host apps should not ship `better-sqlite3/prebuilds/`, and should never `require('better-sqlite3')` directly to open a database.

## Install

```bash
npm i electron-better-sqlite3-sqlcipher better-sqlite3@^13
```

`better-sqlite3` is a peer dependency: the host app provides the single copy that gets rebuilt with SQLCipher.

`postinstall` tries to bootstrap automatically (best effort). If it fails, install still succeeds and you can run strict mode manually.

For deterministic local/CI setup, run strict mode manually:

```bash
npm run sqlcipher:bootstrap:strict
```

Host app resolution:

- Scripts use `ELECTRON_SQLCIPHER_APP_ROOT` (or `INIT_CWD`) to find the host app root.
- The Electron version is read from the host `package.json`. Set `ELECTRON_VERSION` explicitly if it is not found there.

## Platforms

Linux: supported and tested. Windows: supported, to be revalidated after the move to Electron 45, better-sqlite3 13 and SQLCipher 4.20. macOS: not supported yet, never tested.

- Linux: the bundled Bash scripts build and check the runtime.
- Windows: the host app runs its own build (same `node-gyp` flags and amalgamation) and must ship the OpenSSL DLLs next to the executable.
- macOS: the link step uses GNU `ld` flags (`-Wl,--no-as-needed`), so the build script needs adapting before it can be tested.

## System dependencies

Linux: `build-essential`, `python3` and the OpenSSL 3.x development headers (`libssl-dev`). SQLCipher 4.7+ no longer supports OpenSSL older than 3.0.

## SQLCipher version

The amalgamation in `vendor/sqlcipher-amalgamation/` is generated from SQLCipher `v4.20.0` (SQLite 3.54.1) (see `VERSION.txt`). To move to another release, see [`vendor/README.md`](vendor/README.md).

## Runtime versions

- Node.js: `>=22.14.0`
- `better-sqlite3`: `^13.0.3` (N-API)
- Electron host app: `45.x`
