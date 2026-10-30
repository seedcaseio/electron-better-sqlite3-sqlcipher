#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="${ELECTRON_SQLCIPHER_APP_ROOT:-${INIT_CWD:-}}"
if [ -z "$ROOT_DIR" ] || [ ! -f "$ROOT_DIR/package.json" ]; then
  echo "Unable to resolve host app root."
  echo "Set ELECTRON_SQLCIPHER_APP_ROOT to the app directory (must contain package.json)."
  exit 1
fi

cd "$ROOT_DIR"
TMP_SCRIPT="$ROOT_DIR/.tmp-sqlcipher-runtime-check.js"
trap 'rm -f "$TMP_SCRIPT"' EXIT

cat > "$TMP_SCRIPT" <<'EOF'
const { app } = require('electron');

app.whenReady().then(() => {
  try {
    // Same constructor as the app: bound to the SQLCipher build, never the plain SQLite prebuilds.
    const { getSqlcipherDatabaseCtor } = require('electron-better-sqlite3-sqlcipher');
    const Database = getSqlcipherDatabaseCtor();
    const db = new Database(':memory:');
    db.pragma("key='probe'");
    const version = db.pragma('cipher_version', { simple: true });
    const status = db.pragma('cipher_status', { simple: true });
    db.close();
    if (!version) {
      console.error('SQLCipher runtime check failed: cipher_version is empty');
      app.exit(1);
      return;
    }
    if (String(status) !== '1') {
      console.error('SQLCipher runtime check failed: encryption is not active after key');
      app.exit(1);
      return;
    }
    console.log('SQLCipher runtime OK:', version);
    app.exit(0);
  } catch (err) {
    console.error('SQLCipher runtime check failed:', err?.message || String(err));
    app.exit(1);
  }
});
EOF

npx --no electron "$TMP_SCRIPT"
