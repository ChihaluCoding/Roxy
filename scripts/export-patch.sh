#!/usr/bin/env bash
# engine/ での編集内容を patches/ に .patch として書き出す。
#   使い方: scripts/export-patch.sh 0010-vertical-tabs
source "$(dirname "$0")/common.sh"
NAME="${1:-}"
[ -n "$NAME" ] || die "パッチ名を指定してください（例: 0010-vertical-tabs）"

OUT="$PATCHES/$NAME.patch"

# apply-patches.sh がコピー配置する経路は差分に含めない。
# パッチは「上流ファイルへの改変」だけを持つ。
EXCLUDES=(
  ':!obj-*'
  ':!browser/branding/roxy'
  ':!browser/components/roxy'
  ':!browser/extensions/roxy-adblock'
  ':!browser/app/profile/firefox.js'
)

git -C "$ENGINE" add -A -- "${EXCLUDES[@]}" >/dev/null
git -C "$ENGINE" diff --cached --binary roxy-base -- "${EXCLUDES[@]}" > "$OUT"
if [ -s "$OUT" ]; then
  log "書き出し: patches/$NAME.patch ($(wc -l < "$OUT") 行)"
else
  rm -f "$OUT"
  die "差分がありません"
fi
