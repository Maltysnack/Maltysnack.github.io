#!/usr/bin/env bash
# Pull an engine repo and copy what its DISPLAY.md says the page reads.
# Usage: bash scripts/sync-data.sh worldcup|flox|all
# fpl is not here: its own workflow pushes to this repo.
set -euo pipefail
cd "$(dirname "$0")/.."

sync() {  # name engine_path dest src_glob...
  local name=$1 repo=$2 dest=$3; shift 3
  [ -d "$repo/.git" ] || { echo "$name: no clone at $repo" >&2; return 1; }
  git -C "$repo" pull -q --ff-only
  mkdir -p "$dest"
  for f in "$@"; do cp $repo/$f "$dest/"; done  # unquoted on purpose: globs expand in the engine repo
  echo "$name: $(git -C "$repo" log --oneline -1)"
}

worldcup() { sync worldcup ~/worldcup projects/worldcup 'site_data/*.json'; }
flox() {
  sync flox ~/Documents/flox projects/flox ts/dist/flox.js
  sync flox ~/Documents/flox projects/flox/showcase 'examples/showcase/*.flox'
}

case "${1:-}" in
  worldcup) worldcup ;;
  flox) flox ;;
  all) worldcup; flox ;;
  *) echo "usage: $0 worldcup|flox|all" >&2; exit 2 ;;
esac
git status --short projects
