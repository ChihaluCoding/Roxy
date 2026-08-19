/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * 配布サイトからのインストール。
 *
 * *.user.js への遷移を捕まえ、ダウンロードや素の表示ではなく
 * about:roxy の確認画面へ差し替える。Greasy Fork などの
 * 「インストール」ボタンがそのまま使えるようになる。
 *
 * 取得した内容を勝手に入れることはしない。必ず確認画面を出し、
 * 何が入るのか（対象サイト・要求する権限・本文）を見せてから決めさせる。
 */

import {
  setTimeout,
  clearTimeout,
} from "resource://gre/modules/Timer.sys.mjs";

const PREF_ENABLED = "roxy.script.install_from_web";

const FETCH_TIMEOUT_MS = 30 * 1000;
const MAX_BYTES = 10 * 1024 * 1024;

// クエリやフラグメントを除いたパスの末尾で判定する
const USER_SCRIPT_RE = /\.user\.js$/i;

export const InstallHandler = {
  _registered: false,

  init() {
    if (this._registered) {
      return;
    }
    if (!Services.prefs.getBoolPref(PREF_ENABLED, true)) {
      return;
    }
    Services.obs.addObserver(this, "http-on-modify-request");
    this._registered = true;
  },

  observe(subject, topic) {
    if (topic !== "http-on-modify-request") {
      return;
    }
    try {
      this._maybeIntercept(subject.QueryInterface(Ci.nsIHttpChannel));
    } catch (e) {
      // 通常の読み込みを巻き込まないよう、ここでは投げない
      console.error("[Roxy] インストール判定で例外:", e);
    }
  },

  _maybeIntercept(channel) {
    const loadInfo = channel.loadInfo;
    // タブ本体の遷移だけを対象にする。ページ内の <script> などは触らない。
    if (
      loadInfo?.externalContentPolicyType !==
      Ci.nsIContentPolicy.TYPE_DOCUMENT
    ) {
      return;
    }

    const uri = channel.URI;
    if (!/^https?$/.test(uri.scheme) || !USER_SCRIPT_RE.test(uri.filePath)) {
      return;
    }

    // トップレベル遷移では、遷移先のタブを表すのは targetBrowsingContext。
    // browsingContext は「読み込みを開始した側」を指すため、
    // タブ本体の遷移では null になることがある。
    const bc = loadInfo.targetBrowsingContext ?? loadInfo.browsingContext;
    if (!bc) {
      console.warn(`[Roxy] インストール: 遷移先が取れません (${uri.spec})`);
      return;
    }

    // この読み込みは肩代わりするので止める
    channel.cancel(Cr.NS_BINDING_ABORTED);

    const target = `about:roxy#install=${encodeURIComponent(uri.spec)}`;
    // 呼び出し元のスタックから抜けてから遷移させる
    setTimeout(() => {
      try {
        bc.loadURI(Services.io.newURI(target), {
          triggeringPrincipal:
            Services.scriptSecurityManager.getSystemPrincipal(),
        });
        console.log(`[Roxy] インストール画面へ: ${uri.spec}`);
      } catch (e) {
        console.error("[Roxy] インストール画面を開けません:", e);
      }
    }, 0);
  },

  /**
   * インストール候補の本文を取得する。
   *
   * 更新と同じく https のみ。取得した内容はそのまま実行される可能性が
   * あるため、経路が保護されない http は受け付けない。
   *
   * @returns {Promise<object>} { ok, text, error }
   */
  async fetchSource(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return { ok: false, error: `不正な URL です: ${url}` };
    }
    if (parsed.protocol !== "https:") {
      return { ok: false, error: `https 以外は取得しません: ${url}` };
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort("timeout"),
      FETCH_TIMEOUT_MS
    );
    try {
      const response = await fetch(parsed.href, {
        credentials: "omit",
        redirect: "follow",
        cache: "no-cache",
        signal: controller.signal,
      });
      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}` };
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_BYTES) {
        return { ok: false, error: `大きすぎます (${buffer.byteLength} バイト)` };
      }
      return { ok: true, text: new TextDecoder().decode(buffer) };
    } catch (e) {
      return { ok: false, error: String(e) };
    } finally {
      clearTimeout(timer);
    }
  },
};
