#!/usr/bin/env bash
# engine/ での編集内容を patches/ に .patch として書き出す。
#   使い方: scripts/export-patch.sh 0010-vertical-tabs
source "$(dirname "$0")/common.sh"
NAME="${1:-}"
[ -n "$NAME" ] || die "パッチ名を指定してください（例: 0010-vertical-tabs）"

OUT="$PATCHES/$NAME.patch"
git -C "$ENGINE" add -A -- ':!obj-*' >/dev/null
git -C "$ENGINE" diff --cached --binary merlin-base -- ':!browser/branding/merlin' > "$OUT"
[ -s "$OUT" ] && log "書き出し: patches/$NAME.patch ($(wc -l < "$OUT") 行)" || { rm -f "$OUT"; die "差分がありません"; }
