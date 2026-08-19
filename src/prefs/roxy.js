// Roxy の既定 pref。ビルド時に browser/app/profile/firefox.js の末尾へ追記される。
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

// ---- Mozilla 固有の案内 ----
// 設定画面の「Mozilla からのご案内」。表示だけでなく機能ごと止める。
pref("browser.preferences.moreFromMozilla", false);

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

// ---- 決定事項: 無効化しないもの ----
// Safe Browsing は残す（フィッシング/マルウェア保護）。既定値の明示であり、
// プライバシー強化パッチで誤って落とさないための宣言も兼ねる。
pref("browser.safebrowsing.malware.enabled", true);
pref("browser.safebrowsing.phishing.enabled", true);
pref("browser.safebrowsing.downloads.enabled", true);

// User-Agent は Firefox のまま。Roxy を名乗るとフィンガープリント上一意になるため
// general.useragent.* は一切上書きしない。

// ---- UI ----
pref("browser.tabs.inTitlebar", 1);
pref("browser.compactmode.show", true);
// userChrome.css / userContent.css を有効にする（UI 改造の実験用）
pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
