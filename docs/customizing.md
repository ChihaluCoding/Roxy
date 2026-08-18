# 改造の 4 系統

Merlin は独自機能だけでなく、下の 4 系統すべてを扱う。
**どの手段で実現するかを間違えると、上流追従のたびに壊れる**ので、実現手段は上から順に検討する。

| 手段 | 置き場所 | 上流追従の壊れやすさ | 向いていること |
|---|---|---|---|
| 既定 pref | `src/prefs/*.js` | ほぼ壊れない | 挙動の既定値、プライバシー強化 |
| CSS | `src/ui/*.css` | 中（DOM 構造が変わると崩れる） | 見た目、レイアウト調整 |
| 新規ファイル | `src/features/` | 低い | 独自機能の本体 |
| パッチ | `patches/*.patch` | 高い | 上流ファイルへの改変。最後の手段 |

## 1. プライバシー強化

`src/prefs/merlin.js` に既定値を書く。パッチ不要なので上流更新でまず壊れない。
テレメトリ、スポンサーコンテンツ、トラッキング防止、DoH は設定済み。

**pref では消えないもの**（Mozilla への接続そのもの）はビルド設定側で落とす:
`mozconfigs/common` の `--disable-crashreporter` / `--disable-updater` / `MOZ_TELEMETRY_REPORTING=` が該当。

さらに強制したい（ユーザーに変更させたくない）場合は pref ではなく
`browser/components/enterprisepolicies/` 経由の policies.json、または `pref()` を
`lockPref()` に変える。フォークで既定値を変えるだけなら pref で十分。

## 2. UI / UX の刷新

- `src/ui/*.css` に書くと `browser/themes/shared/merlin/` へ配置される
- ただし**取り込ませるには 1 行のパッチが要る**。`browser/themes/shared/browser-shared.css` に
  `@import "chrome://browser/skin/merlin/merlin.css";` を足すパッチを 1 本作り、以降 CSS はパッチなしで編集できる状態にする
- 構造そのものを変える（垂直タブ、サイドバー化）場合は `browser.xhtml` + `browser.js` のパッチになる。
  これは上流追従で最も壊れやすい領域なので、**1 機能 1 パッチ**を厳守する

開発中は `toolkit.legacyUserProfileCustomizations.stylesheets`（既定で有効化済み）を使い、
プロファイルの `userChrome.css` で試作 → 固まったら `src/ui/` に移す、が最短ルート。

## 3. 独自機能

[adding-a-feature.md](adding-a-feature.md) を参照。
新規ファイルは `src/features/` に置き、`browser/components/merlin/` へ配置するパッチ 1 本で繋ぐ。

## 4. エンジン内部の学習・実験

`engine/` を直接いじって `./mach build faster`（フロントエンドのみ、数十秒）で回す。
`mach run --jsdebugger` でブラウザ自身のフロントエンドをデバッグできる。
成果を残したいときだけ `export-patch.sh` する。
