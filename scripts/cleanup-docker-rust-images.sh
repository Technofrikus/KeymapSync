#!/usr/bin/env bash
# Optional: remove official `rust:*` images that were pulled for Docker builds (frees disk space).
# Run when Docker is running: ./scripts/cleanup-docker-rust-images.sh
set -euo pipefail

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running or not reachable. Start Docker Desktop, then retry." >&2
  exit 1
fi

echo "Removing images from repository 'rust' (rust:latest, rust:1.85-bookworm, etc.)..."
ids=$(docker images rust --format '{{.ID}}' | sort -u || true)
if [[ -z "${ids// }" ]]; then
  echo "No rust:* images found."
  exit 0
fi
echo "$ids" | xargs docker rmi -f 2>/dev/null || true
echo "Done. Remaining images:"
docker images rust 2>/dev/null || true
