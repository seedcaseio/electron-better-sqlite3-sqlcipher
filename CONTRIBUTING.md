# Contributing to electron-better-sqlite3-sqlcipher

Thank you for your interest in contributing to this project! Contributions are welcome.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue on GitHub with:

- A clear description of the bug
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Your environment: OS, Node.js, Electron and `better-sqlite3` versions
- Relevant build or error output (never passphrases, encryption keys or real data)

Security problems must not be reported in public issues: see [SECURITY.md](SECURITY.md).

### Proposing Features

Please open an issue to discuss the use case before writing code.

## Development Setup

### Prerequisites

- Node.js >= 22.14.0
- Linux: `build-essential`, `python3` and the OpenSSL 3.x development headers (`libssl-dev`)
- To regenerate the SQLCipher amalgamation only: `git` and `gpg`

### Getting Started

1. Fork the repository on GitHub and clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/electron-better-sqlite3-sqlcipher.git
   cd electron-better-sqlite3-sqlcipher
   ```
2. Install dependencies and build:
   ```bash
   npm ci
   npm run build
   ```
3. Run the tests:
   ```bash
   npm test
   ```

The unit tests do not need a native build. To check the real SQLCipher build, install the package in an Electron app and run `npm run sqlcipher:bootstrap:strict` from it.

### Project Structure

- `src/index.ts` - Public API: opening encrypted databases, security PRAGMAs, SQLCipher checks
- `scripts/` - Bash scripts run on install or by hand:
  - `bootstrap.sh` - Entry point of `postinstall` (best effort) and strict mode
  - `ensure-electron-sqlcipher.sh` - Rebuilds only when Electron or the amalgamation changed
  - `rebuild-electron-sqlcipher.sh` - Compiles `better-sqlite3` with SQLCipher for Electron
  - `check-runtime.sh` - Checks in Electron that SQLCipher is loaded and encryption is active
  - `prepare-amalgamation.sh` - Maintainer tool: regenerates the amalgamation from a verified SQLCipher tag
- `vendor/sqlcipher-amalgamation/` - Vendored SQLCipher amalgamation and its license
- `vendor/keys/` - Public key used to verify SQLCipher release tags
- `tests/` - Unit tests (Vitest)
- `dist/` - Compiled JavaScript output (generated)

## Code Standards

- Follow the existing code style, TypeScript strict mode, 2 spaces, explicit types over `any`.
- Add JSDoc comments for public functions.
- Update `README.md` and `CHANGELOG.md` when behavior or the public API changes.
- Shell scripts use `set -euo pipefail` and must keep working with paths containing spaces.

### Security Rules

- Never weaken the SQLCipher checks: `cipher_version` must be non-empty and `cipher_status` must be active before any write.
- Never load the plain SQLite prebuilds of `better-sqlite3`: always open connections through the SQLCipher binding.
- Keep the pinned key and commit checks in `prepare-amalgamation.sh`.
- Keep `npx --no` and the pinned `node-gyp` log level in the build script: higher log levels print the whole environment, secrets included.
- Never put passphrases, keys or real data in tests, logs or error messages.

### Tests

- New features and bug fixes must include tests, for success and error cases.
- Run `npm test` before submitting.

## Pull Request Process

1. Create a branch from `main` (`feature/your-feature-name` or `fix/your-bug-fix`).
2. Make your changes, with tests and documentation.
3. Make sure `npm run build` and `npm test` pass.
4. Use clear commit messages and reference related issues (e.g. "Fix #123").
5. Open a pull request explaining the change, why it is needed, and any breaking change.

Keep pull requests focused: one feature or fix per pull request.

## Updating SQLCipher

Only maintainers regenerate the vendored amalgamation, following [`vendor/README.md`](vendor/README.md). A pull request that changes `vendor/sqlcipher-amalgamation/` without a matching signed SQLCipher release will not be accepted.

## Code of Conduct

Please be respectful and constructive in all interactions.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
