#!/usr/bin/env bash
# patches/*.patch を番号順に engine/ へ適用し、src/ の追加ファイルを配置する。
source "$(dirname "$0")/common.sh"
[ -d "$ENGINE/.git" ] || die "engine/ がありません。先に scripts/bootstrap.sh を実行してください。"

log "engine/ を roxy-base に巻き戻します"
git -C "$ENGINE" checkout --force roxy-base
git -C "$ENGINE" clean -fd -e obj- >/dev/null

shopt -s nullglob
for p in "$PATCHES"/*.patch; do
  log "apply $(basename "$p")"
  git -C "$ENGINE" apply --index "$p" || die "$(basename "$p") の適用に失敗（upstream 更新でズレた可能性）"
done

# --- ブランディング ---
# upstream の unofficial ブランディングを土台にコピーし、src/branding/ で上書きする。
# （moz.build や configure.sh を自前で書き起こさずに済む）
BR="$ENGINE/browser/branding/roxy"
if [ ! -d "$BR" ]; then
  log "ブランディング雛形を作成: browser/branding/roxy (unofficial ベース)"
  cp -r "$ENGINE/browser/branding/unofficial" "$BR"
fi
if [ -d "$ROOT/src/branding" ] && [ -n "$(ls -A "$ROOT/src/branding" 2>/dev/null)" ]; then
  log "src/branding/ を上書き適用"
  cp -r "$ROOT/src/branding/." "$BR/"
fi

# --- 既定 pref ---
# src/prefs/*.js を firefox.js の末尾に追記する（moz.build を触らずに済む）
if [ -n "$(ls -A "$ROOT/src/prefs" 2>/dev/null)" ]; then
  log "既定 pref を追記: $(ls "$ROOT/src/prefs" | tr '
' ' ')"
  {
    echo ""
    echo "// ==== Roxy defaults (src/prefs/) ===="
    cat "$ROOT"/src/prefs/*.js
  } >> "$ENGINE/browser/app/profile/firefox.js"
fi

# --- Roxy Layer ---
# 新規ファイル群は engine/ 側の対応ディレクトリへコピーする。
# 上流ファイルを書き換えないので、この経路は上流追従で壊れない。
deploy() {  # deploy <src相対> <engine相対>
  [ -d "$ROOT/$1" ] || return 0
  [ -n "$(ls -A "$ROOT/$1" 2>/dev/null)" ] || return 0
  log "配置: $1 -> $2"
  mkdir -p "$ENGINE/$2"
  cp -r "$ROOT/$1/." "$ENGINE/$2/"
}
deploy src/roxy      browser/components/roxy
deploy src/rules       browser/components/roxy/rules
deploy src/extensions/roxy-adblock browser/extensions/roxy-adblock

# about:preferences の Roxy ペイン。
# preferences.xhtml が #include するため、上流のディレクトリへ直接置く。
# 新規ファイルなので上流と衝突しない。
deploy src/roxy/preferences browser/components/preferences

# --- エンタープライズポリシー ---
# policies.json は install 直下の distribution/ に置かれ、pref より強い強制力を持つ。
# 配置先の moz.build への登録は patches/0012 側で行う。
deploy src/policies   browser/app/distribution

log "適用完了"
