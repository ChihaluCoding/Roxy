# Merlin Layer

`engine/browser/components/merlin/` へ配置される、Merlin 本体の JS モジュール群。
Firefox のフロントエンド（chrome 特権）で動く。**新規ファイルなので上流追従で壊れない。**
上流ファイル側は `BrowserGlue` からこの層を呼び出す 1 本のパッチだけで繋ぐ。

| ディレクトリ | 役割 | Phase |
|---|---|---|
| `settings/` | about:merlin、pref との接続 | 2 |
| `script-engine/` | Merlin Script Engine（注入基盤の中核） | 2 |
| `youtube/` | YouTube Compatibility Layer の chrome 側 | 3 |
| `audio/` | Merlin Audio パネル（Web Audio ノードチェーン） | 6 |
| `media/` | PiP 拡張・スクリーンショット | 6 |
| `oshi/` | 推し活プロファイル・ダッシュボード | 5 |
| `ui/` | 縦タブ・ツリータブ・Merlin Toolbar・bang検索 | 7 |
| `network/` | URL Cleaner・ダウンロード強化 | 8 |
