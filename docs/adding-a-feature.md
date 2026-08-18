# 独自機能の追加ポイント

Roxy の主眼は独自機能。Firefox のどこに手を入れるかの地図。

## 1. UI を足す（ツールバー、サイドバー、パネル）
- `browser/base/content/browser.xhtml` … ウィンドウの骨格 XUL/HTML。要素はここに足す
- `browser/base/content/browser.js` … ウィンドウ単位のフロントエンド JS
- `browser/themes/shared/` … スタイル（`.css`）
- `browser/components/` … 機能単位のモジュール。**新規機能はここに 1 ディレクトリ切るのが基本**
  - `moz.build` に `EXTRA_JS_MODULES` / `browser/components/moz.build` の `DIRS` へ登録が必要

## 2. ページの内容に触る（DOM 読み取り、スクリプト注入）
親プロセスと子プロセスが分離しているので **JSActor** を使う。
- `browser/actors/RoxyChild.sys.mjs` / `RoxyParent.sys.mjs`
- `browser/actors/moz.build` と `BrowserGlue.sys.mjs` の `ACTORS` 定義に登録

## 3. 設定値を持つ
- `modules/libpref/init/StaticPrefList.yaml` … C++/JS 両方から引ける静的 pref
- `browser/app/profile/firefox.js` … デフォルト値の上書き（フォークの既定値変更はここが最短）
- `browser/components/preferences/` … about:preferences に UI を出す場合

## 4. ネットワーク層に割り込む
- `netwerk/protocol/http/` … C++。リビルドが重いので最後の手段
- 多くの用途は `nsIWebRequest` 相当の JS API（`WebExtension` 内部 API）で足りる

## 5. 起動時に何かする
- `browser/components/BrowserGlue.sys.mjs` … アプリ全体の初期化フック。独自機能の起点として最も使われる

## パッチの粒度
1 機能 = 1 パッチ。上流更新で壊れたときに、どれを直せばいいか分かる粒度に保つ。
番号は `0010`, `0020`, … と 10 刻みで振り、間に差し込めるようにする。
