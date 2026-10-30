# Vendored SQLCipher

`sqlcipher-amalgamation/` holds the SQLCipher amalgamation that `scripts/rebuild-electron-sqlcipher.sh` compiles into `better-sqlite3`.

## Versioned artifacts

Commit only:

- `sqlcipher-amalgamation/sqlite3.c`
- `sqlcipher-amalgamation/sqlite3.h`
- `sqlcipher-amalgamation/VERSION.txt` (the SQLCipher git tag)

`sqlcipher-src/` is the SQLCipher checkout used to generate them. It is local only and ignored.

## Refresh

```bash
SQLCIPHER_REF=<tag> SQLCIPHER_COMMIT=<full commit hash of the tag> npm run sqlcipher:prepare
```

Requires `git`, `gpg`, a C toolchain and OpenSSL 3.x development headers.

Before building, the script checks that:

- the tag is signed by the pinned subkey `2646E8ECC00DAF4C2F67DBCD19A0457D05EA8350`, using only `keys/sqlcipher-release-signing.asc` in a throwaway keyring;
- the tag points to `SQLCIPHER_COMMIT`. It then builds that exact commit.

## Signing key

`keys/sqlcipher-release-signing.asc` is the public key of Stephen Lombardo (Zetetic), who signs SQLCipher release tags:

- primary key `D92204901CD8BFDF63A2D9F952E8883F1591F4CE`, signing subkey `2646E8ECC00DAF4C2F67DBCD19A0457D05EA8350`;
- fetched from keys.openpgp.org and the Ubuntu keyserver (same key), and used for every release tag from v4.6.1 to v4.20.0;
- Zetetic does not publish this fingerprint: its verification page lists the company key used for binary packages only.

The key expires on 2027-08-02. After that, the signature check fails until the key is refreshed:

```bash
curl -fsS https://keys.openpgp.org/vks/v1/by-fingerprint/D92204901CD8BFDF63A2D9F952E8883F1591F4CE -o keys/sqlcipher-release-signing.asc
```

Check that the primary and signing subkey fingerprints are unchanged before committing it.
