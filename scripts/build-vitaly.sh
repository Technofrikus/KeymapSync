#!/usr/bin/env bash
# Build the vendored vitaly CLI used by gui-electron (dev picks target/release/vitaly).
# Requires **native** Rust on your machine so the binary matches macOS/Windows/Linux.
# For a Linux-only compile via Docker (e.g. CI), use ./scripts/build-vitaly-docker.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VITALY_DIR="$ROOT/Reference only/vitaly-main"

if [[ ! -f "$VITALY_DIR/Cargo.toml" ]]; then
  echo "error: expected $VITALY_DIR/Cargo.toml" >&2
  exit 1
fi

cd "$VITALY_DIR"

if command -v cargo >/dev/null 2>&1; then
  echo "Using: $(command -v cargo) ($(cargo --version))"
  cargo build --release
else
  echo "cargo not in PATH. Install: https://rustup.rs" >&2
  echo "Or build in Docker (produces **Linux** ELF; not for macOS Electron):" >&2
  echo "  $ROOT/scripts/build-vitaly-docker.sh" >&2
  exit 1
fi

BIN="$VITALY_DIR/target/release/vitaly"
if [[ "$(uname -s)" == MINGW* ]] || [[ "$(uname -s)" == *MSYS* ]] || [[ "$(uname -s)" == *CYGWIN* ]]; then
  BIN="${BIN}.exe"
fi

echo ""
echo "Built: $BIN"
"$BIN" -v
