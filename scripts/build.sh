#!/usr/bin/env bash
# mozconfig を選んでビルドする。  使い方: scripts/build.sh [win64|macos-aarch64|macos-x86_64]
source "$(dirname "$0")/common.sh"
require_mozbuild

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  case "$HOST_OS" in
    windows) TARGET=win64 ;;
    macos)   TARGET="macos-$(uname -m | sed 's/arm64/aarch64/')" ;;
    *)       die "ターゲットを指定してください" ;;
  esac
fi
MOZCONFIG_FILE="$ROOT/mozconfigs/$TARGET"
[ -f "$MOZCONFIG_FILE" ] || die "mozconfigs/$TARGET がありません"

export MOZCONFIG="$MOZCONFIG_FILE"
log "ビルド開始 (target=$TARGET)。初回は 1〜3 時間かかります。"
( cd "$ENGINE" && ./mach build )
log "完了。起動は scripts/run.sh"
