// Roxy 独自機能の pref。名前空間は roxy.* に統一する。
// Roxy Settings（about:roxy）はこの pref を読み書きするだけにし、
// 機能側は pref の変化を購読する。UI と機能を pref で疎結合にするのが方針。

// ---- 基盤 (Phase 2) ----
pref("roxy.enabled", true);
pref("roxy.script.enabled", true);          // Roxy Script Engine
pref("roxy.script.userscripts.enabled", true);
pref("roxy.script.usercss.enabled", true);
pref("roxy.script.builtin_rules.enabled", true);
pref("roxy.script.rules.autoupdate", true);
pref("roxy.script.rules.update_interval_hours", 24);

// GM_xmlhttpRequest の接続先を @connect の宣言に限定する。
// この API は同一オリジンポリシーを迂回するため、既定で有効にする。
// 無効にすると、スクリプトが任意のサイトへ利用者の Cookie 付きで
// リクエストできるようになる。
pref("roxy.script.gmxhr.enforce_connect", true);

// GM_info.scriptHandler が名乗る処理系名。既存スクリプトが処理系を
// 判定して分岐することがあるため、互換性を優先して既定は Violentmonkey。
pref("roxy.script.handler_name", "Violentmonkey");

// ユーザースクリプトの自動更新。
// @updateURL / @downloadURL を持つスクリプトを定期的に確認し、
// 新しい版があれば置き換える。配布元を信頼して任意のコードを
// 実行し続けることになる点に注意。
pref("roxy.script.update.enabled", true);
pref("roxy.script.update.interval_hours", 24);

// ---- 汎用ルール (Phase 2) ----
pref("roxy.rules.allow_selection", true);   // テキスト選択禁止の解除
pref("roxy.rules.allow_copy", true);
pref("roxy.rules.allow_contextmenu", true);
pref("roxy.rules.force_dark", false);       // Web コンテンツ側のダークモード

// ---- YouTube (Phase 3) ----
pref("roxy.youtube.enabled", true);
pref("roxy.youtube.hide_shorts", false);
pref("roxy.youtube.hide_mix", false);
pref("roxy.youtube.hide_related", false);
pref("roxy.youtube.hide_comments", false);
pref("roxy.youtube.hide_endcards", false);
pref("roxy.youtube.hide_watched", false);
pref("roxy.youtube.sidebar_comments", false);
pref("roxy.youtube.shorts_in_normal_player", false);
pref("roxy.youtube.show_dislikes", false);  // 外部API依存。既定 OFF

// ---- AdBlock (Phase 4) ----
pref("roxy.adblock.enabled", true);
pref("roxy.adblock.cosmetic", true);
pref("roxy.adblock.scriptlets", true);
pref("roxy.adblock.show_counter", true);
pref("roxy.adblock.autoupdate", true);

// ---- 推し活 (Phase 5) ----
pref("roxy.oshi.enabled", false);
pref("roxy.oshi.notifications", false);

// ---- Audio / Media (Phase 6) ----
pref("roxy.audio.enabled", true);
pref("roxy.audio.normalization", false);    // 互換性確認まで既定 OFF
pref("roxy.audio.compressor", false);
pref("roxy.audio.mono", false);
pref("roxy.audio.max_boost", 500);          // % 上限
pref("roxy.media.pip_extended", true);

// ---- UI (Phase 7) ----
pref("roxy.ui.vertical_tabs", false);
pref("roxy.ui.tree_tabs", false);
pref("roxy.ui.compact", false);
pref("roxy.ui.bang_search", true);

// ---- Network (Phase 8) ----
pref("roxy.network.url_cleaner", true);
pref("roxy.network.download_manager", false);
