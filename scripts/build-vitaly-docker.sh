#!/usr/bin/env bash
# Build vitaly inside Docker (Rust + libudev). Produces a **Linux** binary in
# `Reference only/vitaly-main/target/release/` (same path as native builds).
#
# Use this for CI or to verify compile without local Rust.
# On **macOS**, for the Electron GUI you still need a **native** build:
#   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
#   ./scripts/build-vitaly.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VITALY_DIR="$ROOT/Reference only/vitaly-main"

if [[ ! -f "$VITALY_DIR/Cargo.toml" ]]; then
  echo "error: expected $VITALY_DIR/Cargo.toml" >&2
  exit 1
fi

docker run --rm \
  -v "$VITALY_DIR:/src" \
  -w /src \
  rust:latest \
  bash -c 'export PATH="/usr/local/cargo/bin:$PATH" DEBIAN_FRONTEND=noninteractive && apt-get update -qq && apt-get install -y -qq libudev-dev pkg-config && cargo build --release && ./target/release/vitaly -v'

echo ""
echo "OK: Linux binary -> $VITALY_DIR/target/release/vitaly"
echo "On macOS/Windows, use ./scripts/build-vitaly.sh with native Rust for a GUI-compatible binary."
