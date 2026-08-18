// Merlin の既定 pref。ビルド時に browser/app/profile/firefox.js の末尾へ追記される。
// ユーザーが about:config で上書きできる「既定値」であり、強制ではない。
// 強制したい項目は pref() ではなく lockPref 相当（policies.json）を使うこと。

// ---- テレメトリ / データ送信 ----
pref("toolkit.telemetry.enabled", false);
pref("toolkit.telemetry.unified", false);
pref("toolkit.telemetry.archive.enabled", false);
pref("datareporting.healthreport.uploadEnabled", false);
pref("datareporting.policy.dataSubmissionEnabled", false);
pref("app.shield.optoutstudies.enabled", false);
pref("browser.discovery.enabled", false);
pref("browser.ping-centre.telemetry", false);

// ---- 新規タブ / ホームのスポンサーコンテンツ ----
pref("browser.newtabpage.activity-stream.showSponsored", false);
pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);
pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);
pref("browser.urlbar.suggest.quicksuggest.sponsored", false);

// ---- トラッキング防止 ----
pref("browser.contentblocking.category", "strict");
pref("privacy.trackingprotection.enabled", true);
pref("privacy.trackingprotection.socialtracking.enabled", true);
pref("privacy.donottrackheader.enabled", true);
pref("privacy.globalprivacycontrol.enabled", true);

// ---- ネットワーク ----
pref("network.trr.mode", 2);              // DoH: 使えるなら使う（失敗時は通常DNS）
pref("network.dns.disablePrefetch", true);
pref("network.prefetch-next", false);
pref("browser.send_pings", false);

// ---- UI ----
pref("browser.tabs.inTitlebar", 1);
pref("browser.compactmode.show", true);
// userChrome.css / userContent.css を有効にする（UI 改造の実験用）
pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
