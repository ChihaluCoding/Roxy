/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * GM API をサンドボックスへ公開する（content 側）。
 *
 * Violentmonkey の挙動に合わせる。
 *   - @grant 記述なし … 全 API を公開
 *   - @grant none     … サンドボックス自体を使わない（呼び出し側で分岐）
 *   - @grant 個別指定 … 宣言されたものだけ公開
 *
 * GM_getValue は同期 API のため、値は実行前に親から受け取った
 * スナップショットを使う。更新は手元に反映しつつ親へ通知する。
 */

const Cu = Components.utils;

// GM.* の Promise 版に対応させる名前の対応表
const PROMISE_ALIASES = {
  getValue: "GM_getValue",
  setValue: "GM_setValue",
  deleteValue: "GM_deleteValue",
  listValues: "GM_listValues",
  addStyle: "GM_addStyle",
  log: "GM_log",
  openInTab: "GM_openInTab",
  setClipboard: "GM_setClipboard",
  info: null, // info はプロパティなので別扱い
};

export const GMApi = {
  /**
   * @param {object} opts
   * @param {object} opts.sandbox   対象サンドボックス
   * @param {object} opts.script    スクリプト定義（id, name, code, meta, values）
   * @param {Window} opts.window    対象ページの window
   * @param {Function} opts.send    親へ通知する関数 (name, data) => void
   * @param {Function} opts.query   親へ問い合わせる関数 (name, data) => Promise
   */
  install({ sandbox, script, window, send, query }) {
    const grants = new Set(script.grant || []);
    // @grant が 1 つも無い場合、Violentmonkey は全 API を公開する
    const grantAll = grants.size === 0;
    const allowed = name => grantAll || grants.has(name);

    // 親から渡された値のスナップショット。以降は手元で同期的に読み書きする。
    const values = Object.assign(Object.create(null), script.values || {});

    const api = {};

    // ---- 情報 ----
    api.GM_info = this._buildInfo(script);

    // ---- 保存 ----
    api.GM_getValue = (key, defaultValue) => {
      return key in values ? values[key] : defaultValue;
    };

    api.GM_setValue = (key, value) => {
      // 構造化クローンできない値を弾く。ここで落とさないと
      // 親への送信時に不可解な例外になる。
      let copy;
      try {
        copy = JSON.parse(JSON.stringify(value));
      } catch (e) {
        throw new Error(`GM_setValue: 保存できない値です (${key})`);
      }
      values[key] = copy;
      send("Roxy:GM:SetValue", { scriptId: script.id, key, value: copy });
    };

    api.GM_deleteValue = key => {
      delete values[key];
      send("Roxy:GM:DeleteValue", { scriptId: script.id, key });
    };

    api.GM_listValues = () => Object.keys(values);

    // ---- DOM ----
    api.GM_addStyle = css => {
      const doc = window.document;
      const style = doc.createElement("style");
      style.textContent = String(css);
      // head が無い段階（document-start）でも入れられるようにする
      (doc.head || doc.documentElement).appendChild(style);
      return style;
    };

    api.GM_log = (...args) => {
      console.log(`[Roxy UserScript] ${script.name}:`, ...args);
    };

    // ---- タブ / クリップボード ----
    api.GM_openInTab = (url, options) => {
      // 旧仕様では第2引数が boolean（true = 背景で開く）
      const active =
        typeof options === "boolean" ? !options : options?.active !== false;
      send("Roxy:GM:OpenInTab", { url: String(url), active });
      // 戻り値のタブ操作オブジェクトは未対応。close() だけ空実装で用意する。
      return { close() {} };
    };

    api.GM_setClipboard = text => {
      send("Roxy:GM:SetClipboard", { text: String(text) });
    };

    // ---- 通信 ----
    // 同一オリジンポリシーを迂回するため、実処理は親プロセスで行う。
    // ここは引数の整形と、コールバックの呼び出しだけを担う。
    api.GM_xmlhttpRequest = rawDetails => {
      // サンドボックス由来のオブジェクトは Xray 越しに渡ってくる。
      // そのままだとコールバック関数を読み出せないため、必ず waive する。
      const details = Cu.waiveXrays(rawDetails);
      if (!details || !details.url) {
        throw new Error("GM_xmlhttpRequest: url は必須です");
      }
      const requestId = `${script.id}:${Date.now()}:${Math.random()}`;

      // 関数は構造化クローンできないので、送る前に取り除く
      const headers = {};
      if (details.headers) {
        const h = Cu.waiveXrays(details.headers);
        for (const key of Object.keys(h)) {
          headers[key] = String(h[key]);
        }
      }

      const payload = {
        url: String(details.url),
        method: details.method ? String(details.method) : undefined,
        headers: Object.keys(headers).length ? headers : undefined,
        data: typeof details.data === "string" ? details.data : undefined,
        timeout: Number(details.timeout) || undefined,
        responseType: details.responseType
          ? String(details.responseType)
          : undefined,
        anonymous: !!details.anonymous,
      };

      query("Roxy:GM:Xhr", { details: payload, requestId, scriptId: script.id })
        .then(res => this._deliver(sandbox, window, details, res))
        .catch(e => {
          this._callback(sandbox, details.onerror, { error: String(e) });
        });

      return Cu.cloneInto(
        { abort: () => send("Roxy:GM:AbortXhr", { requestId }) },
        sandbox,
        { cloneFunctions: true }
      );
    };

    // ---- @grant による絞り込み ----
    const exposed = {};
    for (const [name, fn] of Object.entries(api)) {
      // GM_info は Violentmonkey では @grant 不要で常に使える
      if (name === "GM_info" || allowed(name)) {
        exposed[name] = fn;
      }
    }

    // ---- サンドボックスへ公開 ----
    for (const [name, value] of Object.entries(exposed)) {
      sandbox[name] = typeof value === "function"
        ? Cu.exportFunction(value, sandbox)
        : Cu.cloneInto(value, sandbox, { cloneFunctions: false });
    }

    // ---- GM.* （Promise 版）----
    const gm = Cu.createObjectIn(sandbox, { defineAs: "GM" });
    gm.info = Cu.cloneInto(api.GM_info, sandbox);
    for (const [alias, legacy] of Object.entries(PROMISE_ALIASES)) {
      if (!legacy || !exposed[legacy]) {
        continue;
      }
      const fn = exposed[legacy];
      Cu.exportFunction(
        (...args) => {
          // 同期関数を Promise に包む。例外も reject に変換する。
          return new sandbox.Promise((resolve, reject) => {
            try {
              resolve(fn(...args));
            } catch (e) {
              reject(new sandbox.Error(String(e)));
            }
          });
        },
        gm,
        { defineAs: alias }
      );
    }

    // GM.xmlHttpRequest は「応答で解決する Promise」を返す。
    // 中断ハンドルを返す GM_xmlhttpRequest とは戻り値の意味が違うため、
    // 同期ラッパーではなく専用に実装する。
    if (exposed.GM_xmlhttpRequest) {
      Cu.exportFunction(
        details => {
          return new sandbox.Promise((resolve, reject) => {
            const merged = Cu.waiveXrays(Object.assign({}, details));
            merged.onload = resolve;
            merged.onerror = reject;
            merged.ontimeout = reject;
            merged.onabort = reject;
            exposed.GM_xmlhttpRequest(merged);
          });
        },
        gm,
        { defineAs: "xmlHttpRequest" }
      );
    }

    return exposed;
  },

  /**
   * 親からの応答を GM_xmlhttpRequest のコールバックへ渡す。
   */
  _deliver(sandbox, window, details, res) {
    if (!res?.ok) {
      if (res?.timedOut) {
        this._callback(sandbox, details.ontimeout, res);
      } else if (res?.aborted) {
        this._callback(sandbox, details.onabort, res);
      } else {
        this._callback(sandbox, details.onerror, res);
      }
      return;
    }

    const out = {
      readyState: 4,
      status: res.status,
      statusText: res.statusText,
      finalUrl: res.finalUrl,
      responseHeaders: Object.entries(res.responseHeaders || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join("\r\n"),
      responseText: res.responseText ?? "",
      response: null,
    };

    if (res.buffer) {
      // ArrayBuffer で受け取り、要求された型へ content 側で組み立て直す
      const type = (details.responseType || "").toLowerCase();
      out.response =
        type === "blob"
          ? new window.Blob([res.buffer], { type: res.contentType })
          : res.buffer;
    } else if (res.json !== undefined) {
      out.response = res.json;
    } else {
      out.response = res.responseText ?? "";
    }

    this._callback(sandbox, details.onload, out);
  },

  _callback(sandbox, fn, data) {
    if (typeof fn !== "function") {
      // コールバック未指定のまま失敗すると原因が分からないので記録する
      if (data?.error) {
        console.warn("[Roxy] GM_xmlhttpRequest:", data.error);
      }
      return;
    }
    try {
      fn(Cu.cloneInto(data, sandbox, { cloneFunctions: false }));
    } catch (e) {
      console.error("[Roxy] GM_xmlhttpRequest のコールバックで例外:", e);
    }
  },

  /**
   * GM_info を組み立てる。Violentmonkey の構造に寄せる。
   */
  _buildInfo(script) {
    const meta = script.meta || {};
    return {
      // 互換性のため、既定では Violentmonkey を名乗る。
      // 自前実装であることを明示したい場合は
      // roxy.script.handler_name を変更する。
      scriptHandler: script.handlerName || "Violentmonkey",
      version: script.engineVersion || "",
      scriptWillUpdate: false,
      scriptMetaStr: script.metaStr || "",
      uuid: script.id,
      script: {
        name: meta.name || script.name,
        namespace: meta.namespace || "",
        version: meta.version || "",
        description: meta.description || "",
        includes: meta.include || [],
        excludes: meta.exclude || [],
        matches: meta.match || [],
        resources: meta.resource || [],
        runAt: meta.runAt || "document-idle",
        grant: meta.grant || [],
      },
    };
  },
};
