#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
foundry_data="${FOUNDRY_DATA_PATH:-$HOME/Library/Application Support/FoundryVTT/Data}"
target="$foundry_data/systems/wwn"

mkdir -p "$(dirname "$target")"
if [[ -e "$target" && ! -d "$target" ]]; then
  echo "Refusing to overwrite non-directory: $target" >&2
  exit 1
fi

rsync -a --delete \
  --delete-excluded \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'foundry/' \
  --exclude 'wwn.lock' \
  --exclude 'wwn.zip' \
  --exclude '*.log' \
  --exclude 'packs/*/' \
  "$repo_root/" "$target/"

echo "Installed local WWN system to $target"
