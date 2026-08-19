# Roxy

Firefox（mozilla-firefox/firefox）を上流とする、パッチ型フォークブラウザ。
上流ソースはリポジトリに含めず、`patches/` と `src/` に自分の変更だけを保持する
（LibreWolf / Waterfox / Zen Browser と同じ方式）。

## 構成

| パス | 役割 | レイヤー |
|---|---|---|
| `roxy.json` | 上流リポジトリ・タグ・ブランド名の設定 | – |
| `engine/` | 取得した Firefox ソース（**gitignore**。使い捨て） | – |
| `src/rules/` | 内蔵ルール（汎用 / YouTube Compatibility Layer / UserCSS） | 1 |
| `src/extensions/roxy-adblock/` | 内蔵広告ブロック拡張 + 独自フィルタ | 2 |
| `src/roxy/` | Roxy Layer 本体（Settings, Script Engine, Audio, UI, Oshi …） | 3 |
| `src/prefs/` | 既定 pref。`roxy.*` 名前空間 | 3 |
| `src/branding/` | ブランディングの上書き | – |
| `patches/*.patch` | 上流ファイルへの改変。**最後の手段** | 4–5 |
| `mozconfigs/` | ビルド設定。並列度は **10ジョブ固定** | – |
| `scripts/` | 取得・適用・ビルド・パッケージ | – |

数字は実装レイヤー。**上のレイヤーで実現できる機能のために下を変更しない**のが最重要方針
（[docs/architecture.md](docs/architecture.md)）。

## セットアップ

Windows は **必ず MozillaBuild シェル**（`c:\mozilla-build\start-shell.bat`）から実行する。

```bash
./scripts/bootstrap.sh        # ソース取得 + mach bootstrap（初回 30分〜）
./scripts/apply-patches.sh    # patches/ と src/ を engine/ に反映
./scripts/build.sh            # ビルド（初回 約50分、-j10）
./scripts/run.sh              # 起動
./scripts/package.sh          # 配布物を engine/obj-*/dist/ に生成
```

## ドキュメント

| | |
|---|---|
| [docs/architecture.md](docs/architecture.md) | レイヤー構造と、どの機能をどこに置くかの判断基準 |
| [docs/roadmap.md](docs/roadmap.md) | Phase 1–8 と各完了条件 |
| [docs/features.md](docs/features.md) | 機能リスト（チェックボックス） |
| [docs/adding-a-feature.md](docs/adding-a-feature.md) | Firefox 側のフック位置 |

**Phase 2（Roxy 基盤 = Script Engine + Settings）が本命。**
ここを先に作れば Phase 3 以降の大半は「ルールを足すだけ」で済む。

## 開発サイクル

1. `engine/` の中を直接編集する（IDE で開くのはここ）
2. `./scripts/build.sh` で再ビルド（差分ビルドは数分）
3. 満足したら変更をパッチに書き出す:
   ```bash
   ./scripts/export-patch.sh 0010-my-feature
   ```
4. `patches/0010-my-feature.patch` をコミットする

`engine/` はいつ捨てても `bootstrap.sh` + `apply-patches.sh` で再現できる状態を保つこと。

## 上流追従

`roxy.json` の `upstream.tag` は `auto`（最新リリースタグを自動解決）。
バージョンを固定したい場合は `"FIREFOX_153_0_RELEASE"` のように直接書く。
上流更新後に `apply-patches.sh` が失敗したら、そのパッチが当たらなくなった合図。
手で当て直して `export-patch.sh` で書き出し直す。

## macOS 向け

同じスクリプトが動く（MozillaBuild 不要）。Xcode + Command Line Tools が必要。
Windows からの macOS クロスビルドは実質不可能なので、macOS 実機か CI で `scripts/build.sh macos-aarch64` を回す。

## ライセンスと帰属

Roxy は [Mozilla Firefox](https://github.com/mozilla-firefox/firefox) の派生物であり、
上流と同じ **Mozilla Public License 2.0** で提供する（[LICENSE](LICENSE)）。

現在の上流バージョンは [.upstream-tag](.upstream-tag) に記録している（`FIREFOX_153_0_RELEASE`）。

### 商標について

**Roxy は Mozilla の公式製品ではなく、Mozilla とは一切関係がない。**
Firefox および Mozilla は Mozilla Foundation の商標であり、Roxy はこれらを名乗らない。

ビルドは上流の `unofficial` ブランディングを土台にしており、
[src/branding/](src/branding/) で Roxy 用に差し替えている。

なお AppID（`{ec8030f7-…}`）は Firefox と同一のまま維持している。
AMO の拡張機能を互換性チェック無しで利用するためで、変更すると
[src/policies/policies.json](src/policies/policies.json) による uBlock Origin の
強制インストールが壊れる（`roxy.json` の `appIdNote` を参照）。
