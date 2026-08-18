#!/usr/bin/env bash
# Firefox のソースを engine/ に取得し、ビルド依存をセットアップする。
source "$(dirname "$0")/common.sh"
require_mozbuild

TAG="$(resolve_tag)"
log "upstream タグ: $TAG"

if [ ! -d "$ENGINE/.git" ]; then
  log "取得中（shallow clone, 数GB・十数分かかります）..."
  git clone --depth 1 --branch "$TAG" "$UPSTREAM_REMOTE" "$ENGINE"
else
  log "engine/ は取得済み。fetch します..."
  git -C "$ENGINE" fetch --depth 1 origin "refs/tags/$TAG:refs/tags/$TAG"
  git -C "$ENGINE" checkout --force "$TAG"
fi

# パッチ適用の基準点。以降 export-patch.sh はこことの差分を書き出す
git -C "$ENGINE" tag -f merlin-base "$TAG" >/dev/null
echo "$TAG" > "$ROOT/.upstream-tag"

log "mach bootstrap（ツールチェーン取得）..."
( cd "$ENGINE" && ./mach --no-interactive bootstrap --application-choice browser )

log "完了。次は scripts/apply-patches.sh"
