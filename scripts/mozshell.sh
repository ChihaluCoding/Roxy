#!/usr/bin/env bash
# Git Bash など通常のシェルから、MozillaBuild 環境で任意のコマンドを実行するラッパー。
#   例: ./scripts/mozshell.sh ./scripts/build.sh win64
# Windows 以外では素通しする。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) ;;
  *) exec "$@" ;;
esac

MOZBUILD_DIR="${MOZILLABUILD:-C:/mozilla-build}"
MOZ_BASH="$(cygpath -u "$MOZBUILD_DIR" 2>/dev/null || echo /c/mozilla-build)/msys2/usr/bin/bash.exe"
[ -x "$MOZ_BASH" ] || { echo "MozillaBuild が見つかりません: $MOZ_BASH" >&2; exit 1; }

# start-shell.bat が行う PATH 設定（python3 等）は msys2 の profile では入らないため、
# ここで補う。-l は cwd をホームへ戻すので明示的に cd する。
MOZ_U="$(cygpath -u "$MOZBUILD_DIR" 2>/dev/null || echo /c/mozilla-build)"
EXTRA_PATH="$MOZ_U/bin:$MOZ_U/python3:$MOZ_U/python3/Scripts"

# mach は Path.home() を引く。msys2 のログインシェルには USERPROFILE が渡らないことがあり、
# その場合 "Could not determine home directory" で落ちるため明示する。
WINHOME="${USERPROFILE:-${HOMEDRIVE:-C:}${HOMEPATH:-\Users\$USERNAME}}"
WINHOME="${WINHOME//\//}"
MOZBUILD_STATE_PATH="${MOZBUILD_STATE_PATH:-$WINHOME/.mozbuild}"

exec "$MOZ_BASH" -l -c "export MOZILLABUILD='$MOZBUILD_DIR'; export USERPROFILE='$WINHOME'; export HOME='$(cygpath -u "$WINHOME" 2>/dev/null || echo "$WINHOME")'; export MOZBUILD_STATE_PATH='$MOZBUILD_STATE_PATH'; export PATH=\"$EXTRA_PATH:\$PATH\"; cd '$ROOT' && $*"
