# Security Policy

## Supported versions

Only the latest release line receives security fixes.

| Version | Supported |
|---|---|
| 0.2.x | Yes |
| < 0.2 | No |

## Reporting a vulnerability

Please report suspected vulnerabilities privately by email to contact@seedcase.io. Do not open a public issue or pull request for a security problem.

Include, if possible:

- the affected version, platform, Electron and `better-sqlite3` versions;
- a description of the problem and its impact;
- steps or code to reproduce it.

Never send real passphrases, encryption keys or databases containing real data: use throwaway test databases.

A vulnerability in SQLCipher or SQLite themselves should be reported upstream (Zetetic for SQLCipher). Please also let us know, so that the vendored amalgamation can be updated.

## Known limitations

These are documented in the README and are not considered vulnerabilities:

- `cipher_memory_security` is best effort: freed SQLite allocations are zeroed, but locking memory in RAM can silently fail (`RLIMIT_MEMLOCK` on Linux, working set on Windows).
- A connection opened with `getSqlcipherDatabaseCtor()` outside `openEncryptedDatabase` must call `assertCipherAvailable` itself.
- Only Linux is tested. Windows must be revalidated, macOS is not supported yet.

## Supply chain

- On `postinstall`, the package runs Bash scripts that compile the host app's `better-sqlite3` with the vendored SQLCipher amalgamation. `node-gyp` downloads the Electron headers from `electronjs.org`. No package is fetched: `node-gyp` runs with `npx --no`, which fails instead of downloading it from the registry.
- The vendored amalgamation is regenerated only from a SQLCipher release tag signed by a pinned key and pointing to a pinned commit (see `vendor/README.md`).

Thank you for helping keep Seedcase and its users safe.
