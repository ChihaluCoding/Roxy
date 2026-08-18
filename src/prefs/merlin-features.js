// Merlin 独自機能の pref。名前空間は merlin.* に統一する。
// Merlin Settings（about:merlin）はこの pref を読み書きするだけにし、
// 機能側は pref の変化を購読する。UI と機能を pref で疎結合にするのが方針。

// ---- 基盤 (Phase 2) ----
pref("merlin.enabled", true);
pref("merlin.script.enabled", true);          // Merlin Script Engine
pref("merlin.script.userscripts.enabled", true);
pref("merlin.script.usercss.enabled", true);
pref("merlin.script.builtin_rules.enabled", true);
pref("merlin.script.rules.autoupdate", true);
pref("merlin.script.rules.update_interval_hours", 24);

// ---- 汎用ルール (Phase 2) ----
pref("merlin.rules.allow_selection", true);   // テキスト選択禁止の解除
pref("merlin.rules.allow_copy", true);
pref("merlin.rules.allow_contextmenu", true);
pref("merlin.rules.force_dark", false);       // Web コンテンツ側のダークモード

// ---- YouTube (Phase 3) ----
pref("merlin.youtube.enabled", true);
pref("merlin.youtube.hide_shorts", false);
pref("merlin.youtube.hide_mix", false);
pref("merlin.youtube.hide_related", false);
pref("merlin.youtube.hide_comments", false);
pref("merlin.youtube.hide_endcards", false);
pref("merlin.youtube.hide_watched", false);
pref("merlin.youtube.sidebar_comments", false);
pref("merlin.youtube.shorts_in_normal_player", false);
pref("merlin.youtube.show_dislikes", false);  // 外部API依存。既定 OFF

// ---- AdBlock (Phase 4) ----
pref("merlin.adblock.enabled", true);
pref("merlin.adblock.cosmetic", true);
pref("merlin.adblock.scriptlets", true);
pref("merlin.adblock.show_counter", true);
pref("merlin.adblock.autoupdate", true);

// ---- 推し活 (Phase 5) ----
pref("merlin.oshi.enabled", false);
pref("merlin.oshi.notifications", false);

// ---- Audio / Media (Phase 6) ----
pref("merlin.audio.enabled", true);
pref("merlin.audio.normalization", false);    // 互換性確認まで既定 OFF
pref("merlin.audio.compressor", false);
pref("merlin.audio.mono", false);
pref("merlin.audio.max_boost", 500);          // % 上限
pref("merlin.media.pip_extended", true);

// ---- UI (Phase 7) ----
pref("merlin.ui.vertical_tabs", false);
pref("merlin.ui.tree_tabs", false);
pref("merlin.ui.compact", false);
pref("merlin.ui.bang_search", true);

// ---- Network (Phase 8) ----
pref("merlin.network.url_cleaner", true);
pref("merlin.network.download_manager", false);
