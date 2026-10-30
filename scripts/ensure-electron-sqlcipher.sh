#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="${ELECTRON_SQLCIPHER_APP_ROOT:-${INIT_CWD:-}}"
if [ -z "$ROOT_DIR" ] || [ ! -f "$ROOT_DIR/package.json" ]; then
  echo "Unable to resolve host app root."
  echo "Set ELECTRON_SQLCIPHER_APP_ROOT to the app directory (must contain package.json)."
  exit 1
fi
AMALGAMATION_DIR="$PACKAGE_DIR/vendor/sqlcipher-amalgamation"
# Keep stamp outside better-sqlite3/build because that folder can be recreated.
STAMP_FILE="$ROOT_DIR/node_modules/.cache/electron-better-sqlite3-sqlcipher/.sqlcipher-electron-stamp"

if [ ! -f "$AMALGAMATION_DIR/sqlite3.c" ] || [ ! -f "$AMALGAMATION_DIR/sqlite3.h" ]; then
  echo "Missing SQLCipher amalgamation files in $AMALGAMATION_DIR"
  echo "Run: npm run sqlcipher:prepare"
  exit 1
fi

hash_file() {
  local file_path="$1"
  node -e "const fs=require('fs');const crypto=require('crypto');const buf=fs.readFileSync(process.argv[1]);process.stdout.write(crypto.createHash('sha256').update(buf).digest('hex'))" "$file_path"
}

ELECTRON_VERSION="${ELECTRON_VERSION:-}"
if [ -z "$ELECTRON_VERSION" ]; then
  ELECTRON_VERSION="$(node -e "const path=require('path'); const root=process.argv[1]; const pkg=require(path.join(root,'package.json')); const v=(pkg.devDependencies&&pkg.devDependencies.electron)||(pkg.dependencies&&pkg.dependencies.electron)||''; process.stdout.write(v||'');" "$ROOT_DIR")"
fi
if [ -z "$ELECTRON_VERSION" ]; then
  echo "Unable to resolve Electron version from $ROOT_DIR/package.json."
  echo "Set ELECTRON_VERSION explicitly, e.g. ELECTRON_VERSION=45.1.0 npm run sqlcipher:ensure"
  exit 1
fi
SQLITE3_C_HASH="$(hash_file "$AMALGAMATION_DIR/sqlite3.c")"
SQLITE3_H_HASH="$(hash_file "$AMALGAMATION_DIR/sqlite3.h")"
VERSION_FILE_HASH="none"
if [ -f "$AMALGAMATION_DIR/VERSION.txt" ]; then
  VERSION_FILE_HASH="$(hash_file "$AMALGAMATION_DIR/VERSION.txt")"
fi

EXPECTED_STAMP="$ELECTRON_VERSION|$SQLITE3_C_HASH|$SQLITE3_H_HASH|$VERSION_FILE_HASH"

if [ -f "$STAMP_FILE" ]; then
  CURRENT_STAMP="$(cat "$STAMP_FILE")"
  if [ "$CURRENT_STAMP" = "$EXPECTED_STAMP" ]; then
    echo "SQLCipher native build stamp matches for Electron $ELECTRON_VERSION. Verifying runtime..."
    if bash "$PACKAGE_DIR/scripts/check-runtime.sh"; then
      echo "SQLCipher runtime is valid, skipping rebuild."
      exit 0
    fi
    echo "SQLCipher runtime check failed despite matching stamp, forcing rebuild..."
  fi
fi

echo "SQLCipher native build is missing or outdated, rebuilding..."
bash "$PACKAGE_DIR/scripts/rebuild-electron-sqlcipher.sh"

echo "Verifying SQLCipher runtime after rebuild..."
bash "$PACKAGE_DIR/scripts/check-runtime.sh"

mkdir -p "$(dirname "$STAMP_FILE")"
printf '%s\n' "$EXPECTED_STAMP" > "$STAMP_FILE"
echo "Updated SQLCipher build stamp: $STAMP_FILE"
