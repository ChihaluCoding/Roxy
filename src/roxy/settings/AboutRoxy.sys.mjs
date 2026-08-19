/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * about:roxy を chrome://roxy/content/settings.html へ繋ぐ。
 *
 * 特権ページとして親プロセスで開く（URI_SAFE_FOR_UNTRUSTED_CONTENT は付けない）。
 * これにより settings.js から ScriptEngine を直接呼べるため、
 * UI 用のアクターを別途作らずに済む。
 *
 * Web コンテンツから about:roxy へ遷移させてはいけない。
 */

const CHROME_URL = "chrome://roxy/content/settings.html";

export class AboutRoxy {
  QueryInterface = ChromeUtils.generateQI(["nsIAboutModule"]);

  getURIFlags() {
    return (
      Ci.nsIAboutModule.ALLOW_SCRIPT |
      Ci.nsIAboutModule.IS_SECURE_CHROME_UI |
      Ci.nsIAboutModule.HIDE_FROM_ABOUTABOUT
    );
  }

  newChannel(uri, loadInfo) {
    const channel = Services.io.newChannelFromURIWithLoadInfo(
      Services.io.newURI(CHROME_URL),
      loadInfo
    );
    // アドレスバーの表示を about:roxy のまま保つ
    channel.originalURI = uri;
    return channel;
  }

  getChromeURI() {
    return Services.io.newURI(CHROME_URL);
  }
}
