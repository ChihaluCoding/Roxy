#!/usr/bin/env bash
# ビルドしたブラウザを起動する。
source "$(dirname "$0")/common.sh"
require_mozbuild
TARGET="${1:-win64}"
export MOZCONFIG="$ROOT/mozconfigs/$TARGET"
( cd "$ENGINE" && ./mach run )
