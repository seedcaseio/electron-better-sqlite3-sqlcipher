# Release Process

Maintainer checklist for publishing a new version of `electron-better-sqlite3-sqlcipher` to npm.

## 1. Prepare

1. Start from an up-to-date `main` with a clean working tree.
2. Run the checks:
   ```bash
   npm ci
   npm run build
   npm test
   npm audit --omit=dev
   ```
3. Inspect the package contents:
   ```bash
   npm pack --dry-run
   ```
   The tarball must only contain `dist/`, `scripts/`, `vendor/sqlcipher-amalgamation/` (`sqlite3.c`, `sqlite3.h`, `VERSION.txt`, `LICENSE`), `vendor/keys/`, `vendor/README.md`, `README.md`, `CHANGELOG.md`, `LICENSE` and `package.json`. Never `vendor/sqlcipher-src/`, tests, local files or secrets.
4. Test the packed tarball in a real Electron app (Linux at least, Windows when the build changed):
   ```bash
   npm run pack
   # in the Electron app:
   npm install /path/to/build/packages/electron-better-sqlite3-sqlcipher-X.Y.Z.tgz
   npm run sqlcipher:bootstrap:strict
   ```
   The runtime check must print `SQLCipher runtime OK`, then open an existing encrypted database in the app.
5. Check that the SQLCipher signing key in `vendor/keys/` has not expired (currently 2027-08-02).

## 2. Choose the version

Follow [Semantic Versioning](https://semver.org/). While the version is `0.x`, a breaking change bumps the minor version (`0.2.0` to `0.3.0`), anything else bumps the patch version.

Breaking changes include: removing or renaming an export or an npm script, changing the supported Electron, `better-sqlite3` or Node.js versions, and changing SQLCipher in a way that changes the database format or default settings (existing databases must still open).

## 3. Update the files

1. `package.json`: set the new `version` (`npm version <minor|patch> --no-git-tag-version`).
2. `CHANGELOG.md`: rename `Unreleased` to the version and date (`## X.Y.Z - YYYY-MM-DD`), and check that every user-visible change is listed.
3. `SECURITY.md`: update the supported versions table when the release line changes.
4. `README.md`: check the public API, the SQLCipher version and the runtime versions.
5. Run `npm test` again.

## 4. Publish

1. Commit the release: `chore(release): X.Y.Z`.
2. Tag it: `git tag vX.Y.Z`.
3. Push the commit and the tag: `git push && git push origin vX.Y.Z`.
4. Publish: `npm publish` (2FA required). `prepublishOnly` runs the tests and `prepack` rebuilds `dist/`: a failure aborts the publish.
5. Create the GitHub release from the tag, using the changelog section as notes.

## 5. Verify

1. `npm view electron-better-sqlite3-sqlcipher version` shows the new version.
2. Install it from npm in the Electron app and run `npm run sqlcipher:bootstrap:strict`.
