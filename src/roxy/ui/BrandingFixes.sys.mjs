/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * ブランド名の露出を抑えるスタイルの適用。
 *
 * 日本語などの言語パックは自前の brand.ftl を持っており、そこに
 * "Firefox" が入っている。Roxy 側のブランディング（en-US）は上書き
 * されるため、翻訳された画面には Firefox の名前が残る。
 *
 * 正しく直すには Roxy 自身の日本語版をビルドする必要があるが、
 * 当面の措置として、名前が出てしまう箇所の表示を抑える。
 *
 * browser.xhtml へのパッチは避け、スタイルシートを登録して当てる。
 * 上流の XUL を触らないので、Firefox の更新でビルドが壊れない。
 */

const PREF_ENABLED = "roxy.ui.hide_upstream_branding";
const SHEET_URI = "chrome://roxy/content/branding-fix.css";

export const BrandingFixes = {
  _applied: false,

  get _service() {
    return Cc["@mozilla.org/content/style-sheet-service;1"].getService(
      Ci.nsIStyleSheetService
    );
  },

  init() {
    this._update();
    Services.prefs.addObserver(PREF_ENABLED, this);
  },

  observe() {
    this._update();
  },

  _update() {
    const want = Services.prefs.getBoolPref(PREF_ENABLED, true);
    if (want === this._applied) {
      return;
    }
    try {
      const uri = Services.io.newURI(SHEET_URI);
      const type = Ci.nsIStyleSheetService.AUTHOR_SHEET;
      if (want) {
        this._service.loadAndRegisterSheet(uri, type);
      } else if (this._service.sheetRegistered(uri, type)) {
        this._service.unregisterSheet(uri, type);
      }
      this._applied = want;
    } catch (e) {
      console.error("[Roxy] ブランド表示の調整に失敗しました:", e);
    }
  },
};
