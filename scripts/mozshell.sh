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
EXTRA_PATH="$MOZ_U/bin:$MOZ_U/python3:$MOZ_U/python3/Scripts:/c/Program Files/nodejs"

# msys2 のログインシェルには Windows 側の環境変数の一部が渡らない。
# 補わないと以下で落ちる:
#   - mach: Path.home() が解決できず "Could not determine home directory"
#   - mozbuild/nodeutil.py: ProgramFiles / PROGRAMW6432 / SystemDrive が None
WINHOME="${USERPROFILE:-C:/Users/$USERNAME}"
MOZBUILD_STATE_PATH="${MOZBUILD_STATE_PATH:-$WINHOME/.mozbuild}"
PF="${ProgramFiles:-C:\Program Files}"

exec "$MOZ_BASH" -l -c "
export MOZILLABUILD='$MOZBUILD_DIR'
export MACH_HIDE_DEV_DRIVE_SUGGESTION=1
export USERPROFILE='$WINHOME'
export HOME='$(cygpath -u "$WINHOME" 2>/dev/null || echo "$WINHOME")'
export MOZBUILD_STATE_PATH='$MOZBUILD_STATE_PATH'
export SystemDrive='${SystemDrive:-C:}'
export ProgramFiles='$PF'
export PROGRAMFILES='$PF'
export PROGRAMW6432='$PF'
export PATH=\"$EXTRA_PATH:\$PATH\"
cd '$ROOT'
$*"
