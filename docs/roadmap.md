# 実装フェーズ

各 Phase の完了条件と、対応するディレクトリ・パッチ番号帯。
詳細な機能リストは `docs/features.md`。

| Phase | 内容 | 主な置き場所 | パッチ番号帯 |
|---|---|---|---|
| 1 | Firefox フォーク成立（無改造ビルド → ブランディング → 起動確認） | `src/branding/` | `0000-0099` |
| 2 | Roxy 基盤（pref / Settings / Script Engine / 内蔵拡張の器） | `src/roxy/settings`, `src/roxy/script-engine` | `0100-0199` |
| 3 | YouTube（Compatibility Layer） | `src/rules/youtube/` | `0300-0399` |
| 4 | AdBlock（内蔵拡張 + Filter Updater） | `src/extensions/roxy-adblock/` | `0400-0499` |
| 5 | 推し活（Oshi Profile / ダッシュボード / 通知） | `src/roxy/oshi/` | `0500-0599` |
| 6 | Audio / Media（Audio パネル / PiP / Screenshot） | `src/roxy/audio`, `src/roxy/media` | `0600-0699` |
| 7 | Browser UI（縦タブ / ツリー / Toolbar / URLバー） | `src/roxy/ui/` | `0700-0799` |
| 8 | Advanced（Network / DL / DevTools / Mozilla依存整理 / Update） | `src/roxy/network/` | `0800-0899` |

パッチ番号は帯の中で 10 刻み（`0110`, `0120`, …）。間に差し込めるようにする。

## Phase 1 の完了条件
- [ ] `scripts/bootstrap.sh` 成功
- [ ] 無改造で `scripts/build.sh` 成功（**ここを先に通す。改造は必ずその後**）
- [ ] Roxy branding / アイコン / 名称
- [ ] `scripts/run.sh` で起動、about:support に Roxy と表示される

## Phase 2 の完了条件（ここが本命の基盤）
- [ ] `roxy.*` pref が効く
- [ ] `about:roxy` が開き、pref を読み書きできる
- [ ] Script Engine が document-start で CSS/JS を注入できる
- [ ] UserScript メタデータパーサが `@match` / `@run-at` を解釈する
- [ ] 内蔵ルールが 1 本動く（例: 右クリック禁止の解除）
- [ ] 内蔵 WebExtension が起動時から有効になる器ができている

**Phase 2 が終われば、Phase 3 以降の大半は「ルールを足すだけ」になる。**
逆に Phase 2 を飛ばして個別機能を本体へ書き始めると、後から全部書き直しになる。

## Mozilla 依存の整理（Phase 8）
**いきなり削除しない。** `残す → 無効化 → 置換 → 完全削除` の順で判断する。
現時点で `mozconfigs/common` にて crashreporter / updater / telemetry をビルド時無効化済み。
Pocket・Accounts・Sync・Safe Browsing は**方針未決**。調査してから決める（削除すると
Safe Browsing のようにセキュリティ機能を失うものがある）。
