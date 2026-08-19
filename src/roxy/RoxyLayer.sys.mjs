/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Roxy Layer のエントリポイント。
 *
 * 上流ファイルへのフックは BrowserGlue からこの init() を呼ぶ 1 本だけに保つ
 * （patches/0013-roxy-layer-bootstrap.patch）。
 * 機能を足すときはこのファイルからサブモジュールを起動する。
 * 上流ファイルへのパッチを増やさないこと。
 */

const PREF_ENABLED = "roxy.enabled";

// 起動したことを about:config から確認するための実行時 pref。
// 既定 pref には書かず、起動のたびにこちらで設定する。
const PREF_READY = "roxy.layer.ready";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrandingFixes: "resource:///modules/roxy/BrandingFixes.sys.mjs",
  ScriptEngine: "resource:///modules/roxy/ScriptEngine.sys.mjs",
});

export const RoxyLayer = {
  _initialized: false,

  /**
   * BrowserGlue の _beforeUIStartup から呼ばれる。
   * ここで重い処理をすると起動が遅くなるので、実際の機能は遅延ロードする。
   */
  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    if (!Services.prefs.getBoolPref(PREF_ENABLED, true)) {
      this.log("roxy.enabled が false のため起動しません");
      Services.prefs.setBoolPref(PREF_READY, false);
      return;
    }

    Services.prefs.setBoolPref(PREF_READY, true);
    this.log(`起動しました (Roxy ${Services.appinfo.version})`);

    // --- サブモジュールの起動位置 ---
    // 例外が出ても他の機能とブラウザ本体を巻き込まないよう個別に囲む。
    try {
      lazy.BrandingFixes.init();
    } catch (e) {
      console.error("[Roxy] ブランド表示の調整に失敗しました:", e);
    }

    try {
      lazy.ScriptEngine.init();
    } catch (e) {
      console.error("[Roxy] Script Engine の起動に失敗しました:", e);
    }
  },

  log(msg) {
    console.log(`[Roxy] ${msg}`);
  },
};
