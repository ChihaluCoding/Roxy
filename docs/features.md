# 機能リスト

実装レイヤーは `docs/architecture.md`、順序は `docs/roadmap.md`。
L列 = 実装レイヤー（1:ルール 2:拡張 3:Roxy Layer 4:上流パッチ 5:Gecko）。

## 1. スクリプト／スタイル注入基盤 (Phase 2 / L3)
- [ ] User Scripts（Tampermonkey 相当を内蔵）
- [ ] カスタム CSS（Stylus 相当）
- [ ] サイト単位の JS/CSS ルール
- [ ] 内蔵プリセットルール
- [ ] ユーザー作成ルール
- [ ] ルールのインポート / エクスポート
- [ ] ルール自動更新機構
- [ ] UserScript メタデータパーサ（`@name` `@match` `@run-at` `@grant`）
- [ ] GM_* 互換レイヤー（`GM_getValue` `GM_setValue` `GM_xmlhttpRequest` `GM_addStyle` `GM_registerMenuCommand`）
- [ ] MAIN world 相当への注入

## 2. 汎用ルール (Phase 2 / L1)
- [ ] テキスト選択禁止の解除
- [ ] コピー禁止の解除
- [ ] 右クリック禁止の解除
- [ ] ダークモード強制（単純反転ではなく、背景/文字/画像を判定して部分変換）
- [ ] サイト単位での機能 ON/OFF

Firefox のテーマ機能とは分離し、**Web コンテンツ側のダークモード**として実装する。

## 3. YouTube Enhancement (Phase 3 / L1)
### 要素の個別非表示
- [ ] Shorts 棚 / Mix / 急上昇 / ライブ棚 / 関連動画
- [ ] 終了画面カード / アノテーション / プレイヤー上オーバーレイ
- [ ] コメント欄 / 固定コメント / サイドバー
- [ ] ヘッダー各ボタン / 通知ベル / チャンネル名 / 共有ボタン
- [ ] サムネイル上の進捗バー / 動画時間バッジ

### フィルタ・レイアウト
- [ ] チャンネル単位のブロック（検索結果 / 関連 / ホームから除外）
- [ ] フィルタの一時解除
- [ ] 視聴済み動画を非表示
- [ ] Shorts を通常プレイヤーで開く
- [ ] コメント欄を動画横へ移動 / サイドバーモード
- [ ] 低評価数表示 ← **外部 API 依存。独立モジュールにし、停止しても他へ影響させない**

## 4. 広告ブロック (Phase 4 / L2)
- [ ] 起動時から有効な内蔵拡張
- [ ] 通常のアンインストールを想定しない構成
- [ ] Roxy Settings から ON/OFF、サイト単位 ON/OFF
- [ ] ブロック数表示
- [ ] フィルターリスト管理 / カスタムフィルター / 自動更新
- [ ] Cosmetic Filtering / Scriptlets
- [ ] Roxy 独自フィルタ（base / youtube / privacy / unbreak）
- [ ] Filter Updater（本体更新と分離）

## 5. 音声処理 (Phase 6 / L3)
すべて 1 つの Roxy Audio パネルへ統合。Web Audio API を利用。

`MediaElementSource → Gain → Normalization → Compressor → Pitch → Channel → Destination`

- [ ] 音量コントローラー / 100% 超の増幅 / タブ別音量
- [ ] 音量バランス均一化 / 動画間のラウドネス統一（既定 ON は互換性確認後）
- [ ] コンプレッサ（プリセット: 夜間 / 配信 / 映画。上級者向けに threshold, knee, ratio, attack, release）
- [ ] モノラル化（片耳イヤホン向け）
- [ ] 音声ピッチ変更

## 6. メディア / PiP (Phase 6 / L3-L4)
Chromium の Document PiP API を前提にせず、**Firefox 既存 PiP 実装を調査して拡張**する。
- [ ] 複数動画の同時 PiP
- [ ] PiP 内シークバー / 再生速度 / 音量 / 次動画
- [ ] 一般ページのスクリーンショット（Firefox 既存機能の再利用を優先）
- [ ] YouTube 動画スクリーンショット（`canvas.drawImage(video,0,0)`）

## 7. ブラウザ UI (Phase 7 / L3-L4)
- [ ] 縦タブ / 横タブ切り替え / タブツリー / コンパクトモード
- [ ] タブグループの外観変更 / サイドバー
- [ ] Roxy Toolbar / Roxy メニュー / 推し活 UI
- [ ] URL バー拡張、bang 検索（`!yt` `!g` `!x` `!wiki` `!gh` をユーザー登録可能に）
- [ ] Roxy 独自設定ページ

## 8. Roxy Settings (Phase 2 / L3)
`about:roxy` 専用ページ、または about:preferences へ統合。
カテゴリ: General / Appearance / Tabs / YouTube / Oshi / Audio / AdBlock /
User Scripts / Custom CSS / Privacy / Downloads / Advanced

pref 名前空間は `roxy.*`（`src/prefs/roxy-features.js` に定義済み）。

## 9. 推し活機能 (Phase 5 / L3)
特定 VTuber 専用にはせず、**ユーザーが自分の推しを設定できる構造**にする。
画像・商標を本体へ同梱しない。

`Oshi Profile = Name / YouTube Channel / Theme / Accent Color / Background / Bookmarks / Preferences`

- [ ] 推しプロフィール登録（複数可） / YouTube チャンネル登録
- [ ] 推しカラー / 背景画像 / 推し別テーマ
- [ ] 推し別ブックマーク / 推し別タブグループ
- [ ] 配信予定 / LIVE 表示 / 新着動画 / 配信通知
- [ ] 推しダッシュボード

## 10. ネットワーク・ダウンロード (Phase 8 / L3)
- [ ] URL クリーナー（`utm_*` `fbclid` `gclid` 等）+ Allow List / Exception Rules
- [ ] ダウンロード強化 / 分割ダウンロード / 同時接続数設定 / 速度表示
- [ ] YouTube Downloader（動画 / 音声のみ / 品質選択）
      ← **規約・著作権・地域法令を確認。公開版への搭載は別途判断**

## 11. 開発者向けツール (Phase 8 / L4)
既存 DevTools をゼロから作り直さず**拡張**する。
- [ ] 複数解像度同時プレビュー / Responsive Design Mode 拡張
- [ ] 要素サイズ・座標の即時表示 / 配色表示 / リンクホバープレビュー
- [ ] 画像編集（トリミング / リサイズ / PNG・JPEG・WebP・AVIF 変換）

## 12. Firefox 固有機能の整理 (Phase 8)
**いきなり削除しない。** `残す → 無効化 → 置換 → 完全削除` の順で判断。
- [x] Telemetry 方針（pref + ビルド時無効化で対応済み）
- [x] Crash Reporter（ビルド時無効化）
- [ ] ブランド / ロゴ / 名称の置換 ← Phase 1
- [x] **User-Agent: Firefox のまま変更しない**（決定）— Roxy を名乗るとフィンガープリント上一意になり、
      サイト側の UA 判定でも壊れやすい。`general.useragent.*` の上書きは行わない
- [ ] Pocket 整理 / Mozilla サービス依存の調査
- [ ] Firefox Accounts / Sync 方針（自前サーバが要る）
- [ ] Update Server 方針（`--disable-updater` 中。独自更新は Phase 8）
- [x] **Safe Browsing: 残す**（決定）— フィッシング/マルウェア保護を維持する。
      `browser.safebrowsing.*` は無効化しない。プライバシー強化の名目でも削除対象にしない
