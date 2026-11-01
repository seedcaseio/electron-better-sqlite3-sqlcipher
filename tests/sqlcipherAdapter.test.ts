import { describe, expect, it } from 'vitest';
import * as path from 'path';
import {
  applySecurityPragmas,
  assertCipherAvailable,
  assertEncryptionActive,
  closeDatabase,
  createSqlcipherDatabaseCtor,
  isCipherAvailable,
  openEncryptedDatabase,
  resolveSqlcipherBindingPath,
  runMigrations,
} from '../src';

type FakeDb = {
  closed: boolean;
  pragmaCalls: string[];
  execCalls: string[];
  close: () => void;
  pragma: (query: string, options?: { simple?: boolean }) => unknown;
  exec: (query: string) => void;
};

// cipherStatus null: the pragma is unknown, as on a plain SQLite build.
function createFakeDb(cipherVersion: string | undefined, cipherStatus: string | null = '1'): FakeDb {
  return {
    closed: false,
    pragmaCalls: [],
    execCalls: [],
    close() {
      this.closed = true;
    },
    pragma(query: string, options?: { simple?: boolean }) {
      this.pragmaCalls.push(query);
      if (query === 'cipher_version' && options?.simple) return cipherVersion;
      if (query === 'cipher_status' && options?.simple) return cipherStatus ?? undefined;
      return undefined;
    },
    exec(query: string) {
      this.execCalls.push(query);
    },
  };
}

describe('sqlcipher adapter', () => {
  it('opens encrypted database and applies expected PRAGMA initialization', () => {
    const fakeDb = createFakeDb('4.20.0 community');
    const FakeCtor = class {
      constructor(_path: string) {
        return fakeDb;
      }
    } as unknown as new (path: string) => any;

    const db = openEncryptedDatabase({
      dbPath: ':memory:',
      passphrase: "abc'def",
      databaseCtor: FakeCtor,
    });

    expect(db).toBe(fakeDb);
    expect(fakeDb.pragmaCalls).toContain("key='abc''def'");
    // Memory security is enabled before the key so key derivation is covered.
    expect(fakeDb.pragmaCalls.indexOf('cipher_memory_security = ON')).toBeLessThan(
      fakeDb.pragmaCalls.indexOf("key='abc''def'"),
    );
    expect(fakeDb.pragmaCalls).toContain('kdf_iter=256000');
    expect(fakeDb.pragmaCalls).toContain('journal_mode = WAL');
    expect(fakeDb.pragmaCalls).toContain('foreign_keys = ON');
    expect(fakeDb.pragmaCalls).toContain('secure_delete = ON');
    closeDatabase();
    expect(fakeDb.closed).toBe(true);
  });

  it('fails explicitly when SQLCipher is unavailable', () => {
    const fakeDb = createFakeDb(undefined);
    const FakeCtor = class {
      constructor(_path: string) {
        return fakeDb;
      }
    } as unknown as new (path: string) => any;

    expect(() =>
      openEncryptedDatabase({
        dbPath: ':memory:',
        passphrase: 'secret',
        databaseCtor: FakeCtor,
      }),
    ).toThrow(/SQLCipher is not available/);
    // Nothing was written (no key, no journal_mode=WAL) before the cipher check failed.
    expect(fakeDb.pragmaCalls).toEqual(['cipher_version']);
    expect(fakeDb.closed).toBe(true);
  });

  it('runs migration callback on active database', () => {
    const fakeDb = createFakeDb('4.20.0 community');
    const FakeCtor = class {
      constructor(_path: string) {
        return fakeDb;
      }
    } as unknown as new (path: string) => any;

    openEncryptedDatabase({ dbPath: ':memory:', passphrase: 'secret', databaseCtor: FakeCtor });
    runMigrations((db: any) => {
      db.exec('CREATE TABLE IF NOT EXISTS test_table(id INTEGER PRIMARY KEY)');
    });
    expect(fakeDb.execCalls[0]).toContain('CREATE TABLE IF NOT EXISTS test_table');
    closeDatabase();
  });

  it('checks cipher availability via health check', () => {
    const fakeDb = createFakeDb('4.20.0 community');
    const FakeCtor = class {
      constructor(_path: string) {
        return fakeDb;
      }
    } as unknown as new (path: string) => any;
    expect(isCipherAvailable(FakeCtor)).toBe(true);
  });

  it('exposes pragma helper for custom settings', () => {
    const fakeDb = createFakeDb('4.20.0 community');
    applySecurityPragmas(fakeDb as any, 'secret', {
      kdfIter: 1000,
      memorySecurity: false,
      foreignKeys: false,
      secureDelete: false,
      journalMode: 'DELETE',
    });
    // memorySecurity: false skips the pragma (SQLCipher cannot turn it off anyway).
    expect(fakeDb.pragmaCalls).toEqual([
      "key='secret'",
      'cipher_status',
      'kdf_iter=1000',
      'journal_mode = DELETE',
      'foreign_keys = OFF',
      'secure_delete = OFF',
    ]);
  });

  it('rejects invalid pragma options before sending anything to the database', () => {
    const invalidOptions = [
      { kdfIter: 0 },
      { kdfIter: -1 },
      { kdfIter: 1.5 },
      { kdfIter: Number.NaN },
      { kdfIter: '1000; PRAGMA rekey=x' },
      { journalMode: 'wal' },
      { journalMode: 'WAL; PRAGMA rekey=x' },
    ];
    for (const options of invalidOptions) {
      const fakeDb = createFakeDb('4.20.0 community');
      expect(() => applySecurityPragmas(fakeDb as any, 'secret', options as any)).toThrow(/Invalid (kdfIter|journalMode)/);
      expect(fakeDb.pragmaCalls).toEqual([]);
    }
  });

  it('closes the database when openEncryptedDatabase gets invalid options', () => {
    const fakeDb = createFakeDb('4.20.0 community');
    const FakeCtor = class {
      constructor(_path: string) {
        return fakeDb;
      }
    } as unknown as new (path: string) => any;
    expect(() =>
      openEncryptedDatabase({ dbPath: ':memory:', passphrase: 'secret', databaseCtor: FakeCtor, kdfIter: -1 }),
    ).toThrow(/Invalid kdfIter/);
    expect(fakeDb.closed).toBe(true);
  });

  it('resolves the SQLCipher build of better-sqlite3, not its plain SQLite prebuilds', () => {
    const entry = path.join('/app', 'node_modules', 'better-sqlite3', 'lib', 'index.js');
    const bindingPath = resolveSqlcipherBindingPath(() => entry);
    expect(bindingPath).toBe(
      path.join('/app', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
    );
    expect(bindingPath).not.toContain('prebuilds');
  });

  it('resolves the installed better-sqlite3 by default', () => {
    expect(resolveSqlcipherBindingPath()).toMatch(/better-sqlite3[\\/]build[\\/]Release[\\/]better_sqlite3\.node$/);
  });

  it('always passes the SQLCipher build as nativeBinding', () => {
    const calls: Array<{ dbPath: string; options: unknown }> = [];
    const fakeDb = createFakeDb('4.20.0 community');
    const FakeModule = class {
      constructor(dbPath: string, options?: unknown) {
        calls.push({ dbPath, options });
        return fakeDb;
      }
    } as unknown as new (path: string, options?: object) => any;

    const Ctor = createSqlcipherDatabaseCtor(FakeModule, '/app/build/Release/better_sqlite3.node');
    const db = new Ctor('/vault/db.sqlite');

    expect(db).toBe(fakeDb);
    expect(calls).toEqual([
      { dbPath: '/vault/db.sqlite', options: { nativeBinding: '/app/build/Release/better_sqlite3.node' } },
    ]);
  });

  it('exposes the cipher guard for connections opened outside openEncryptedDatabase', () => {
    expect(() => assertCipherAvailable(createFakeDb(undefined) as any)).toThrow(/SQLCipher is not available/);
    expect(() => assertCipherAvailable(createFakeDb('4.20.0 community') as any)).not.toThrow();
  });

  it('refuses to write when the key did not activate encryption', () => {
    const fakeDb = createFakeDb('4.20.0 community', '0');
    const FakeCtor = class {
      constructor(_path: string) {
        return fakeDb;
      }
    } as unknown as new (path: string) => any;

    expect(() =>
      openEncryptedDatabase({ dbPath: ':memory:', passphrase: 'secret', databaseCtor: FakeCtor }),
    ).toThrow(/encryption is not active/);
    // Stopped right after the key: no kdf_iter, journal_mode or other write.
    expect(fakeDb.pragmaCalls).toEqual([
      'cipher_version',
      'cipher_memory_security = ON',
      "key='secret'",
      'cipher_status',
    ]);
    expect(fakeDb.closed).toBe(true);
  });

  it('exposes the encryption guard', () => {
    expect(() => assertEncryptionActive(createFakeDb('4.20.0 community', '0') as any)).toThrow(/not active/);
    expect(() => assertEncryptionActive(createFakeDb('4.20.0 community', null) as any)).toThrow(/not active/);
    expect(() => assertEncryptionActive(createFakeDb('4.20.0 community', '1') as any)).not.toThrow();
  });
});
