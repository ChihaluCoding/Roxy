# Merlin Script Engine

**最優先。グループ2以降の機能はこの上に載る。**

Firefox 固有コードとエンジン本体を分離する構造:

```
script-engine/
├─ core/          … Firefox 非依存。ルール管理・マッチング・UserScript メタデータパーサ
├─ gm-api/        … GM_* 互換レイヤー（core 側に置く）
└─ platform/      … Firefox 依存。JSActor・注入タイミング・MAIN world 注入
```

## 注入経路（Firefox での実装候補）

| 用途 | 手段 | 備考 |
|---|---|---|
| document-start での CSS | `nsIStyleSheetService` (chrome 特権) | 最速。FOUC が出ない |
| document-start での JS | JSActor の `DOMDocElementInserted` | content world |
| MAIN world への注入 | `Cu.exportFunction` / `wrappedJSObject`、または `WebExtensionPolicy` の userScripts world | ページ側の変数に触る必要がある場合のみ |
| 遅延実行 | JSActor の `DOMContentLoaded` / `load` | `@run-at` に対応させる |

`browser.scripting` / WebExtension content scripts は**拡張として実装する場合の経路**。
内蔵基盤としては JSActor 経路を主とし、拡張 API には依存させない。

## メタデータパーサ

`// ==UserScript== … // ==/UserScript==` ブロックを解析する。
最低限 `@name` `@match` `@include` `@exclude` `@run-at` `@grant` `@require` `@version`。
**パーサは Firefox に一切依存させない**（単体テスト可能に保つ）。

## GM_* 互換

`GM_getValue` / `GM_setValue` … 保存先は `merlin.script.storage`（JSONFile）。
`GM_xmlhttpRequest` … CORS を跨ぐため parent プロセス側で fetch して結果を返す。
`GM_addStyle` / `GM_registerMenuCommand` … chrome 側に橋渡し。
