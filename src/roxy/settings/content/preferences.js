/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * about:preferences の Roxy ペイン。
 *
 * preferences.xhtml から読み込まれ、preferences.js が用意する
 * register_module / Preferences を使う（どちらもそのスコープの大域）。
 *
 * 設定の切り替えだけを担当し、スクリプトの編集など重い UI は
 * about:roxy 側に置く。Firefox 本体の設定画面と役割を揃える。
 */

/* global register_module, Preferences, gSubDialog */

var gRoxyPane = {
  init() {
    // 設定画面の再設計モード（browser.settings-redesign.enabled）では
    // preferences.js 側がテンプレートを展開しない。展開しないと中身が
    // mainPrefPane の子にならず、表示処理（data-category による絞り込み）の
    // 対象外になって空のペインになる。ここで自前で展開する。
    const template = document.getElementById("template-paneRoxy");
    if (template) {
      template.replaceWith(template.content);
    }

    Preferences.addAll([
      { id: "roxy.enabled", type: "bool" },
      { id: "roxy.script.enabled", type: "bool" },
      { id: "roxy.script.gmxhr.enforce_connect", type: "bool" },
    ]);

    // 挿入した要素は preference 属性を持つので、値を読み直させる
    Preferences.queueUpdateOfAllElements();

    document
      .getElementById("roxyOpenManager")
      .addEventListener("command", () => {
        // 設定画面を潰さずに別タブで開く
        window.browsingContext.topChromeWindow.openTrustedLinkIn(
          "about:roxy",
          "tab"
        );
      });
  },
};

register_module("paneRoxy", gRoxyPane);
