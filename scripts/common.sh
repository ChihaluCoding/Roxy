# 全スクリプト共通の設定。単体では実行しない。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE="$ROOT/engine"
PATCHES="$ROOT/patches"

cfg() {
  python -c "
import json,sys
d=json.load(open(sys.argv[1]))
for k in sys.argv[2].split('.'): d=d[k]
print(d)
" "$ROOT/roxy.json" "$1"
}

APP_NAME="$(cfg name)"
UPSTREAM_REMOTE="$(cfg upstream.remote)"
UPSTREAM_TAG="$(cfg upstream.tag)"

case "$(uname -s)" in
  MINGW*|MSYS*) HOST_OS=windows ;;
  Darwin)       HOST_OS=macos ;;
  *)            HOST_OS=linux ;;
esac

log()  { printf '\033[36m[roxy]\033[0m %s\n' "$*"; }
die()  { printf '\033[31m[roxy] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# Windows では MozillaBuild シェル内でのみ mach が動く
require_mozbuild() {
  [ "$HOST_OS" = windows ] || return 0
  [ -n "${MOZILLABUILD:-}" ] || die "MozillaBuild シェル外です。c:/mozilla-build/start-shell.bat から実行してください。"
}

# 最新の FIREFOX_xxx_y_RELEASE タグを解決する
resolve_tag() {
  if [ "$UPSTREAM_TAG" != auto ]; then echo "$UPSTREAM_TAG"; return; fi
  git ls-remote --tags "$UPSTREAM_REMOTE" 'FIREFOX_*_RELEASE'     | sed 's#.*refs/tags/##; s#\^{}##'     | grep -E '^FIREFOX_[0-9]+(_[0-9]+)+_RELEASE$'     | sort -u | sort -V | tail -1
}
