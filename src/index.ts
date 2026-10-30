import * as path from 'path';
import type BetterSqlite3 from 'better-sqlite3';

export type BetterSqlite3Database = BetterSqlite3.Database;
export type BetterSqlite3Ctor = new (path: string) => BetterSqlite3Database;
type BetterSqlite3Module = new (path: string, options?: BetterSqlite3.Options) => BetterSqlite3Database;

export type SecurityPragmaOptions = {
  kdfIter?: number;
  foreignKeys?: boolean;
  secureDelete?: boolean;
  journalMode?: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
};

export type OpenEncryptedDatabaseOptions = SecurityPragmaOptions & {
  dbPath: string;
  passphrase: string;
  databaseCtor?: BetterSqlite3Ctor;
};

const DEFAULT_KDF_ITER = 256000;
let activeDb: BetterSqlite3Database | null = null;

export function openEncryptedDatabase(options: OpenEncryptedDatabaseOptions): BetterSqlite3Database {
  if (activeDb) return activeDb;
  const db = new (options.databaseCtor ?? getSqlcipherDatabaseCtor())(options.dbPath);
  try {
    // Check SQLCipher before any PRAGMA that writes (journal_mode=WAL): a plain SQLite
    // build must never create an unencrypted vault file. cipher_version needs no key.
    assertCipherAvailable(db);
    applySecurityPragmas(db, options.passphrase, options);
  } catch (err) {
    db.close();
    throw err;
  }
  activeDb = db;
  return db;
}

export function closeDatabase(): void {
  if (!activeDb) return;
  activeDb.close();
  activeDb = null;
}

export function runMigrations(migrate: (db: BetterSqlite3Database) => void = () => {}): void {
  if (!activeDb) throw new Error('Database is not open. Call openEncryptedDatabase() first.');
  migrate(activeDb);
}

export function isCipherAvailable(databaseCtor?: BetterSqlite3Ctor): boolean {
  const DbCtor = databaseCtor ?? getSqlcipherDatabaseCtor();
  let db: BetterSqlite3Database | null = null;
  try {
    db = new DbCtor(':memory:');
    db.pragma("key='probe'");
    const cipherVersion = db.pragma('cipher_version', { simple: true }) as string | undefined;
    return Boolean(cipherVersion);
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export function applySecurityPragmas(
  db: BetterSqlite3Database,
  passphrase: string,
  options?: SecurityPragmaOptions,
): void {
  const escapedKey = passphrase.replace(/'/g, "''");
  db.pragma(`key='${escapedKey}'`);
  db.pragma(`kdf_iter=${options?.kdfIter ?? DEFAULT_KDF_ITER}`);
  db.pragma(`journal_mode = ${options?.journalMode ?? 'WAL'}`);
  db.pragma(`foreign_keys = ${options?.foreignKeys === false ? 'OFF' : 'ON'}`);
  db.pragma(`secure_delete = ${options?.secureDelete === false ? 'OFF' : 'ON'}`);
}

/** Throws unless the connection runs SQLCipher. Call it on every connection the app opens. */
export function assertCipherAvailable(db: BetterSqlite3Database): void {
  const cipherVersion = db.pragma('cipher_version', { simple: true }) as string | undefined;
  if (!cipherVersion) {
    throw new Error(
      'SQLCipher is not available in current SQLite runtime. Build better-sqlite3 against SQLCipher before starting the app.',
    );
  }
}

/**
 * Path of the SQLCipher build of better-sqlite3 (`node-gyp rebuild --force_build=1 --sqlite3=...`).
 * better-sqlite3 13 ships prebuilt binaries built with plain SQLite and loads them first,
 * so the SQLCipher build must always be passed explicitly as `nativeBinding`.
 */
export function resolveSqlcipherBindingPath(resolve: (id: string) => string = require.resolve): string {
  const entry = resolve('better-sqlite3'); // <package>/lib/index.js
  return path.join(path.dirname(entry), '..', 'build', 'Release', 'better_sqlite3.node');
}

export function createSqlcipherDatabaseCtor(
  DatabaseModule: BetterSqlite3Module,
  nativeBinding: string,
): BetterSqlite3Ctor {
  return function SqlcipherDatabase(dbPath: string) {
    return new DatabaseModule(dbPath, { nativeBinding });
  } as unknown as BetterSqlite3Ctor;
}

let sqlcipherDatabaseCtor: BetterSqlite3Ctor | null = null;

/** better-sqlite3 constructor bound to the SQLCipher build: use it for every connection. */
export function getSqlcipherDatabaseCtor(): BetterSqlite3Ctor {
  if (!sqlcipherDatabaseCtor) {
    sqlcipherDatabaseCtor = createSqlcipherDatabaseCtor(loadBetterSqlite3Module(), resolveSqlcipherBindingPath());
  }
  return sqlcipherDatabaseCtor;
}

function loadBetterSqlite3Module(): BetterSqlite3Module {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('better-sqlite3') as BetterSqlite3Module | { default: BetterSqlite3Module };
  if (typeof mod === 'function') return mod;
  if (mod && typeof mod.default === 'function') return mod.default;
  throw new Error('Failed to load better-sqlite3');
}
