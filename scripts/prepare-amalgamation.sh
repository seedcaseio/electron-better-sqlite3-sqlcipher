#!/usr/bin/env bash
set -euo pipefail

# Maintainer tool: regenerates the vendored SQLCipher amalgamation (sqlite3.c + sqlite3.h,
# the whole library merged into one C file) for SQLCIPHER_REF. The generated files are
# committed and shipped, and rebuild-electron-sqlcipher.sh compiles them. bootstrap.sh only
# runs this script when those files are missing.

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR_DIR="$PACKAGE_DIR/vendor"
SRC_DIR="$VENDOR_DIR/sqlcipher-src"
OUT_DIR="$VENDOR_DIR/sqlcipher-amalgamation"
SQLCIPHER_REF="${SQLCIPHER_REF:-v4.20.0}"
# Commit the tag must point to. Required when SQLCIPHER_REF is overridden.
if [ "$SQLCIPHER_REF" = "v4.20.0" ]; then
  SQLCIPHER_COMMIT="${SQLCIPHER_COMMIT:-355d4db92d3404e71faa8088d071a71d767807f4}"
fi
if [ -z "${SQLCIPHER_COMMIT:-}" ]; then
  echo "Set SQLCIPHER_COMMIT to the full commit hash of $SQLCIPHER_REF."
  exit 1
fi

# Release tags are signed by Stephen Lombardo (Zetetic). Only this signing subkey of
# vendor/keys/sqlcipher-release-signing.asc is accepted.
SIGNING_KEY_FILE="$VENDOR_DIR/keys/sqlcipher-release-signing.asc"
SIGNING_SUBKEY_FPR="2646E8ECC00DAF4C2F67DBCD19A0457D05EA8350"

mkdir -p "$VENDOR_DIR"

if [ ! -d "$SRC_DIR/.git" ]; then
  git clone https://github.com/sqlcipher/sqlcipher.git "$SRC_DIR"
fi

git -C "$SRC_DIR" fetch --tags --force

# Verify the tag signature in a throwaway keyring holding only the pinned key.
command -v gpg >/dev/null || { echo "gpg is required to verify the SQLCipher release tag."; exit 1; }
VERIFY_HOME="$(mktemp -d)"
trap 'rm -rf "$VERIFY_HOME"' EXIT
chmod 700 "$VERIFY_HOME"
GNUPGHOME="$VERIFY_HOME" gpg --batch --quiet --import "$SIGNING_KEY_FILE" 2>/dev/null
if ! VERIFY_OUTPUT="$(GNUPGHOME="$VERIFY_HOME" git -C "$SRC_DIR" verify-tag --raw "$SQLCIPHER_REF" 2>&1)"; then
  echo "SQLCipher tag $SQLCIPHER_REF: signature check failed (unsigned, unknown key or expired key)."
  echo "If the key expired, refresh vendor/keys/sqlcipher-release-signing.asc (see vendor/README.md)."
  exit 1
fi
if ! printf '%s\n' "$VERIFY_OUTPUT" | grep -q "^\[GNUPG:\] VALIDSIG $SIGNING_SUBKEY_FPR "; then
  echo "SQLCipher tag $SQLCIPHER_REF is not signed by the pinned subkey $SIGNING_SUBKEY_FPR."
  exit 1
fi

# The tag must still point to the expected commit; build that exact commit.
TAG_COMMIT="$(git -C "$SRC_DIR" rev-parse "$SQLCIPHER_REF^{commit}")"
if [ "$TAG_COMMIT" != "$SQLCIPHER_COMMIT" ]; then
  echo "SQLCipher tag $SQLCIPHER_REF points to $TAG_COMMIT, expected $SQLCIPHER_COMMIT."
  exit 1
fi
git -C "$SRC_DIR" checkout --quiet "$SQLCIPHER_COMMIT"
echo "SQLCipher $SQLCIPHER_REF verified: signed by $SIGNING_SUBKEY_FPR, commit $SQLCIPHER_COMMIT."

(
  cd "$SRC_DIR"
  ./configure --with-tempstore=yes CFLAGS='-DSQLITE_HAS_CODEC -DSQLITE_EXTRA_INIT=sqlcipher_extra_init -DSQLITE_EXTRA_SHUTDOWN=sqlcipher_extra_shutdown' LDFLAGS='-lcrypto' --disable-tcl
  make sqlite3.c
)

mkdir -p "$OUT_DIR"
cp "$SRC_DIR/sqlite3.c" "$OUT_DIR/sqlite3.c"
cp "$SRC_DIR/sqlite3.h" "$OUT_DIR/sqlite3.h"
# SQLCipher license (BSD-style): its notice must ship with the amalgamation.
cp "$SRC_DIR/LICENSE.md" "$OUT_DIR/LICENSE"
printf '%s\n' "$SQLCIPHER_REF" > "$OUT_DIR/VERSION.txt"

echo "Prepared SQLCipher amalgamation in $OUT_DIR"
