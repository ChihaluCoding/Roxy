#!/usr/bin/env bash
# patches/*.patch を番号順に engine/ へ適用し、src/ の追加ファイルを配置する。
source "$(dirname "$0")/common.sh"
[ -d "$ENGINE/.git" ] || die "engine/ がありません。先に scripts/bootstrap.sh を実行してください。"

log "engine/ を merlin-base に巻き戻します"
git -C "$ENGINE" checkout --force merlin-base
git -C "$ENGINE" clean -fd -e obj- >/dev/null

shopt -s nullglob
for p in "$PATCHES"/*.patch; do
  log "apply $(basename "$p")"
  git -C "$ENGINE" apply --index "$p" || die "$(basename "$p") の適用に失敗（upstream 更新でズレた可能性）"
done

# --- ブランディング ---
# upstream の unofficial ブランディングを土台にコピーし、src/branding/ で上書きする。
# （moz.build や configure.sh を自前で書き起こさずに済む）
BR="$ENGINE/browser/branding/merlin"
if [ ! -d "$BR" ]; then
  log "ブランディング雛形を作成: browser/branding/merlin (unofficial ベース)"
  cp -r "$ENGINE/browser/branding/unofficial" "$BR"
fi
if [ -d "$ROOT/src/branding" ] && [ -n "$(ls -A "$ROOT/src/branding" 2>/dev/null)" ]; then
  log "src/branding/ を上書き適用"
  cp -r "$ROOT/src/branding/." "$BR/"
fi

# --- 既定 pref ---
# src/prefs/*.js を firefox.js の末尾に追記する（moz.build を触らずに済む）
if [ -n "$(ls -A "$ROOT/src/prefs" 2>/dev/null)" ]; then
  PROFILE_JS="$ENGINE/browser/app/profile/firefox.js"
  log "既定 pref を追記: $(ls "$ROOT/src/prefs" | tr '
' ' ')"
  {
    printf '
// ==== Merlin defaults (src/prefs/) ====
'
    cat "$ROOT"/src/prefs/*.js
  } >> "$PROFILE_JS"
fi

# --- UI スタイル ---
# src/ui/*.css を共通テーマに取り込む
if [ -n "$(ls -A "$ROOT/src/ui" 2>/dev/null)" ]; then
  log "UI スタイルを配置: browser/themes/shared/merlin/"
  mkdir -p "$ENGINE/browser/themes/shared/merlin"
  cp "$ROOT"/src/ui/*.css "$ENGINE/browser/themes/shared/merlin/" 2>/dev/null || true
fi

log "適用完了"
