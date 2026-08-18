# Roxy アーキテクチャ

```
                    Roxy Browser
                          │
              ┌───────────┴───────────┐
         Firefox / Gecko          Roxy Layer
                                      │
             ┌────────────────────────┼─────────────────────┐
       Browser UI              Web Features          Internal Extension
       src/roxy/ui           src/roxy/*          src/extensions/
       src/roxy/settings     src/rules/            roxy-adblock/
```

## 最重要方針: 実装レイヤーの優先順位

**上のレイヤーで実現できる機能のために、下のレイヤーを変更しない。**
下へ行くほど上流追従時のコンフリクトが増える。

| # | レイヤー | 置き場所 | 上流追従 | 再ビルド |
|---|---|---|---|---|
| 1 | CSS / UserScript ルール | `src/rules/` | 壊れない | 不要（実行時読み込み） |
| 2 | WebExtension | `src/extensions/` | 壊れない | 不要（フィルタ更新のみ） |
| 3 | Firefox Browser UI / JS | `src/roxy/` | ほぼ壊れない（新規ファイル） | faster ビルド |
| 4 | Firefox 内部 API | `patches/` | 壊れやすい | 通常ビルド |
| 5 | Gecko C++ / Rust | `patches/` | **最も壊れやすい** | フルビルド（時間） |

`src/roxy/` がレイヤー 3 に置かれているのが構造の要。
新規ファイルなので上流と衝突せず、上流ファイル側は
**`BrowserGlue.sys.mjs` から Roxy Layer を起動する 1 本のパッチ**だけで繋ぐ。
機能を足すたびにパッチが増える構造にはしない。

## ディレクトリ対応

| Roxy | Firefox ツリー内 | 配置方法 |
|---|---|---|
| `src/roxy/` | `browser/components/roxy/` | コピー |
| `src/rules/` | `browser/components/roxy/rules/` | コピー |
| `src/extensions/roxy-adblock/` | `browser/extensions/roxy-adblock/` | コピー |
| `src/branding/` | `browser/branding/roxy/` | unofficial ベース + 上書き |
| `src/prefs/*.js` | `browser/app/profile/firefox.js` | 末尾へ追記 |
| `patches/*.patch` | 上流ファイル各所 | `git apply` |

コピー配置は `scripts/apply-patches.sh` が行う。**`engine/` は常に使い捨て可能に保つ。**

## 機能をどのレイヤーに置くか（判断例）

| 機能 | レイヤー | 理由 |
|---|---|---|
| 右クリック禁止の解除 | 1 | CSS/JS ルールで足りる |
| YouTube 要素の非表示 | 1 | DOM 変更に追従しやすい |
| 広告ブロック | 2 | 本体再ビルドなしでフィルタ更新したい |
| Roxy Settings (about:roxy) | 3 | chrome 特権 UI が必要 |
| Script Engine の注入フック | 3 | JSActor は chrome 側 |
| 音量 100% 超の増幅 | 3 | Web Audio ノードを chrome から差し込む |
| 縦タブ・ツリータブ | 3 + 4 | 本体は新規ファイル、`browser.xhtml` への差し込みだけパッチ |
| PiP 拡張 | 4 | Firefox 既存 PiP 実装の改変 |
| URL Cleaner | 3 | Gecko の netwerk 層には触らない |

**レイヤー 5（Gecko C++/Rust）に降りる機能は、現時点の要件には無い。**
必要になった時点で、本当に上のレイヤーで無理か再検証する。

## Script Engine と AdBlock の境界

どちらも要素を消せるため役割が重なる。境界を先に決めておく:

- **AdBlock** — 広告・トラッカーの除去。ネットワーク遮断を伴うもの。フィルタ構文（ABP形式）
- **Script Engine** — サイトの挙動・レイアウト変更。UserScript / UserCSS 形式

YouTube の広告は AdBlock、YouTube の Shorts 非表示は Script Engine（ルール）。
