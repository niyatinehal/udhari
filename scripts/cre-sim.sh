#!/usr/bin/env bash
# Simulate a CRE workflow and broadcast its report to Fuji.
#   scripts/cre-sim.sh relay-ping
#   scripts/cre-sim.sh ops '{"action":"verify","investor":"0x..."}'
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
# cre-compile looks for bun.exe on PATH; an npm-installed bun only puts a shim there.
if [ -d "$APPDATA/npm/node_modules/bun/bin" ]; then
  export PATH="$(cygpath -u "$APPDATA")/npm/node_modules/bun/bin:$PATH"
fi
cre="${CRE_BIN:-$HOME/.cre/bin/cre.exe}"
workflow="$1"
args=(workflow simulate "$workflow" --target staging-settings --env ../.env --non-interactive --trigger-index 0 --broadcast)
if [ $# -ge 2 ]; then args+=(--http-payload "$2"); fi
cd "$here/cre" && "$cre" "${args[@]}"
