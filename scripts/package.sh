#!/usr/bin/env bash
# 配布用アーカイブ／インストーラを作る。
source "$(dirname "$0")/common.sh"
require_mozbuild
TARGET="${1:-win64}"
export MOZCONFIG="$ROOT/mozconfigs/$TARGET"
( cd "$ENGINE" && ./mach package )
log "成果物: engine/obj-$TARGET/dist/"
