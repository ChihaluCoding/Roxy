/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * GM_xmlhttpRequest の実処理（親プロセス側）。
 *
 * この API は同一オリジンポリシーを意図的に迂回する。content プロセスに
 * 実装してはならず、必ずここで実行する。
 *
 * 接続先は @connect で宣言されたホストに限る。宣言の無いスクリプトから
 * 任意のサイトへ、利用者の Cookie 付きでリクエストできてしまうと、
 * 認証済みセッションの内容を外部へ持ち出せる。既定では遮断する。
 *   roxy.script.gmxhr.enforce_connect = false で無効化できるが、
 *   その意味を理解した上でのみ変更すること。
 */

import {
  setTimeout,
  clearTimeout,
} from "resource://gre/modules/Timer.sys.mjs";

const PREF_ENFORCE = "roxy.script.gmxhr.enforce_connect";

// 応答本文の上限。際限なく親のメモリへ載せないための歯止め。
const MAX_RESPONSE_BYTES = 50 * 1024 * 1024;

const DEFAULT_TIMEOUT_MS = 60 * 1000;

/** @type {Map<string, AbortController>} */
const inflight = new Map();

/**
 * @connect の宣言に対してホストが許可されているか判定する。
 *
 * Violentmonkey と同様、以下を許可する。
 *   - @connect で列挙されたホスト（サブドメインも含む）
 *   - @connect * / <all_urls>
 *   - リクエスト元ページと同じホスト
 */
function isConnectAllowed(host, connectList, pageHost) {
  if (!Services.prefs.getBoolPref(PREF_ENFORCE, true)) {
    return true;
  }
  if (pageHost && host === pageHost) {
    return true;
  }
  for (const entry of connectList || []) {
    const e = entry.trim().toLowerCase();
    if (e === "*" || e === "<all_urls>") {
      return true;
    }
    if (host === e || host.endsWith(`.${e}`)) {
      return true;
    }
  }
  return false;
}

function headersToObject(headers) {
  const out = {};
  for (const [k, v] of headers) {
    out[k] = v;
  }
  return out;
}

export const XhrService = {
  /**
   * @param {object} details content から渡された GM_xmlhttpRequest の引数
   * @param {object} ctx { requestId, connect, pageHost, scriptName }
   * @returns {Promise<object>} 応答（構造化クローン可能な形）
   */
  async request(details, ctx) {
    let url;
    try {
      url = new URL(details.url);
    } catch (e) {
      return { ok: false, error: `不正な URL です: ${details.url}` };
    }

    if (!/^https?:$/.test(url.protocol)) {
      return { ok: false, error: `対応していないスキームです: ${url.protocol}` };
    }

    if (!isConnectAllowed(url.hostname, ctx.connect, ctx.pageHost)) {
      const msg =
        `@connect に ${url.hostname} が宣言されていないため遮断しました。` +
        `スクリプトの ==UserScript== に "// @connect ${url.hostname}" を追加してください。`;
      console.warn(`[Roxy UserScript] ${ctx.scriptName}: ${msg}`);
      return { ok: false, error: msg, blocked: true };
    }

    const controller = new AbortController();
    inflight.set(ctx.requestId, controller);

    const timeoutMs = Number(details.timeout) > 0
      ? Number(details.timeout)
      : DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

    try {
      const response = await fetch(url.href, {
        method: (details.method || "GET").toUpperCase(),
        headers: details.headers || {},
        body: details.data ?? null,
        // anonymous 指定時は Cookie を送らない
        credentials: details.anonymous ? "omit" : "include",
        redirect: "follow",
        signal: controller.signal,
      });

      const buffer = await this._readBody(response);

      const result = {
        ok: true,
        status: response.status,
        statusText: response.statusText,
        finalUrl: response.url,
        responseHeaders: headersToObject(response.headers),
      };

      // responseType に応じて content へ渡す形を変える。
      // ArrayBuffer は構造化クローンできるので、blob もこれで送って
      // content 側で組み立て直す。
      const type = (details.responseType || "").toLowerCase();
      if (type === "arraybuffer" || type === "blob") {
        result.buffer = buffer;
        result.contentType = response.headers.get("content-type") || "";
      } else {
        const text = new TextDecoder().decode(buffer);
        result.responseText = text;
        if (type === "json") {
          try {
            result.json = JSON.parse(text);
          } catch (e) {
            result.json = null;
          }
        }
      }
      return result;
    } catch (e) {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        return {
          ok: false,
          aborted: true,
          timedOut: reason === "timeout",
          error: reason === "timeout" ? "タイムアウトしました" : "中断されました",
        };
      }
      return { ok: false, error: String(e) };
    } finally {
      clearTimeout(timer);
      inflight.delete(ctx.requestId);
    }
  },

  async _readBody(response) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_RESPONSE_BYTES) {
      throw new Error(
        `応答が大きすぎます (${buffer.byteLength} バイト、上限 ${MAX_RESPONSE_BYTES})`
      );
    }
    return buffer;
  },

  abort(requestId) {
    inflight.get(requestId)?.abort("abort");
    inflight.delete(requestId);
  },
};
