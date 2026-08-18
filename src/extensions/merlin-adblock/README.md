# Merlin AdBlock（内蔵 WebExtension）

**Firefox 本体には実装しない。** 内蔵拡張として同梱し、
`engine/browser/extensions/merlin-adblock/` へ配置する。

理由: 本体再ビルドなしにフィルタを更新でき、Gecko の変更が要らない。

```
Network Filtering  … webRequest / declarativeNetRequest
Cosmetic Filtering … 要素非表示（Script Engine 側と役割が重なるため境界を決めること）
Scriptlets         … ページ内 API の差し替え
Filter Lists       … EasyList 等 + Merlin 独自
```

## 同梱の要件
- 起動時から有効（`browser/extensions/moz.build` の `DIRS` に登録し、システムアドオン扱いにする）
- 通常のアンインストール動線を想定しない（設定は Merlin Settings 側の ON/OFF に集約）
- 有効/無効は pref `merlin.adblock.enabled` と連動

## フィルタ
`filters/` に Merlin 独自リストを置く。公開リスト（EasyList 等）は**同梱せず取得**する
（ライセンス表記と更新の都合）。

- `merlin-base.txt`
- `merlin-youtube.txt`
- `merlin-privacy.txt`
- `merlin-unbreak.txt`

## 更新
ブラウザ本体の更新とフィルタ更新を分離する。Filter Updater が独自にバージョンを持ち、
YouTube 側の変更へ再ビルドなしで追従する。
