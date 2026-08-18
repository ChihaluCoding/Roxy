# Merlin

Firefox（mozilla-firefox/firefox）を上流とする、パッチ型フォークブラウザ。
上流ソースはリポジトリに含めず、`patches/` と `src/` に自分の変更だけを保持する
（LibreWolf / Waterfox / Zen Browser と同じ方式）。

## 構成

| パス | 役割 |
|---|---|
| `merlin.json` | 上流リポジトリ・タグ・ブランド名の設定 |
| `engine/` | 取得した Firefox ソース（**gitignore**。使い捨て） |
| `patches/*.patch` | 上流ファイルへの変更。番号順に適用 |
| `src/branding/` | ブランディングの上書きファイル（コピーで配置） |
| `src/features/` | 独自機能の新規ファイル置き場 |
| `mozconfigs/` | ビルド設定。並列度は **8ジョブ固定** |
| `scripts/` | 取得・適用・ビルド・パッケージ |

## セットアップ

Windows は **必ず MozillaBuild シェル**（`c:\mozilla-build\start-shell.bat`）から実行する。

```bash
./scripts/bootstrap.sh        # ソース取得 + mach bootstrap（初回 30分〜）
./scripts/apply-patches.sh    # patches/ と src/ を engine/ に反映
./scripts/build.sh            # ビルド（初回 1〜3時間、-j8）
./scripts/run.sh              # 起動
./scripts/package.sh          # 配布物を engine/obj-*/dist/ に生成
```

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

`merlin.json` の `upstream.tag` は `auto`（最新リリースタグを自動解決）。
バージョンを固定したい場合は `"FIREFOX_153_0_RELEASE"` のように直接書く。
上流更新後に `apply-patches.sh` が失敗したら、そのパッチが当たらなくなった合図。
手で当て直して `export-patch.sh` で書き出し直す。

## macOS 向け

同じスクリプトが動く（MozillaBuild 不要）。Xcode + Command Line Tools が必要。
Windows からの macOS クロスビルドは実質不可能なので、macOS 実機か CI で `scripts/build.sh macos-aarch64` を回す。
