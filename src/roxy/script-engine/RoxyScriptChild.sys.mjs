/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Script Engine の content 側アクター。
 *
 * ページごとにサンドボックスを作り、そこでユーザースクリプトを実行する。
 * サンドボックスはページの JS から到達できないため、ページ側スクリプトに
 * 改竄されない。ページの世界へ触れたいときだけ unsafeWindow を使う。
 *
 * このプロセスには特権が無い。ファイル入出力やクロスオリジン通信が要る
 * 処理は、必ず親アクターへ委譲すること。
 */

const Cu = Components.utils;

// DOM イベント名 → @run-at の値
const EVENT_TO_RUN_AT = {
  DOMDocElementInserted: "document-start",
  DOMContentLoaded: "document-end",
  load: "document-idle",
};

export class RoxyScriptChild extends JSWindowActorChild {
  #scriptsPromise = null;
  #executed = new Set();

  handleEvent(event) {
    const runAt = EVENT_TO_RUN_AT[event.type];
    if (!runAt) {
      return;
    }
    // load は capture で拾うため img や iframe の読み込み完了も流れてくる。
    // 自分のドキュメント自身の load だけを document-idle とみなす。
    if (event.type === "load" && event.target !== this.document) {
      return;
    }
    this.#runScriptsFor(runAt);
  }

  /**
   * 親からスクリプト一覧を取得する。ドキュメントごとに 1 回だけ問い合わせる。
   */
  #getScripts() {
    if (!this.#scriptsPromise) {
      const url = this.document?.documentURI ?? "";
      this.#scriptsPromise = this.sendQuery("Roxy:GetScripts", {
        url,
        isTopLevel: this.browsingContext === this.browsingContext.top,
      }).catch(e => {
        console.error("[Roxy] スクリプト取得に失敗しました:", e);
        return [];
      });
    }
    return this.#scriptsPromise;
  }

  async #runScriptsFor(runAt) {
    let scripts;
    try {
      scripts = await this.#getScripts();
    } catch (e) {
      return;
    }

    // await の間にページが破棄されている場合がある
    if (!this.contentWindow || !this.document) {
      return;
    }

    for (const script of scripts) {
      if (script.runAt !== runAt || this.#executed.has(script.id)) {
        continue;
      }
      this.#executed.add(script.id);
      this.#execute(script);
    }
  }

  #execute(script) {
    const win = this.contentWindow;
    if (!win) {
      return;
    }

    let sandbox;
    try {
      sandbox = Cu.Sandbox(win, {
        // ページのグローバルをプロトタイプにすることで、window / document を
        // そのまま参照できる。Xray 越しなのでページ側の細工は見えない。
        sandboxPrototype: win,
        wantXrays: true,
        wantComponents: false,
        sameZoneAs: win,
        sandboxName: `roxy-userscript:${script.id}`,
      });

      // ページの世界へ意図的に降りるための出口。
      // GM API（M3）を足すまでは、これが唯一の越境手段。
      sandbox.unsafeWindow = Cu.waiveXrays(win);
    } catch (e) {
      this.#reportError(script, `サンドボックスを作れません: ${e}`);
      return;
    }

    try {
      Cu.evalInSandbox(
        script.code,
        sandbox,
        "latest",
        `roxy-userscript:${script.id}`,
        1
      );
    } catch (e) {
      this.#reportError(script, `${e}\n${e?.stack ?? ""}`);
    }
  }

  #reportError(script, detail) {
    try {
      this.sendAsyncMessage("Roxy:Log", { scriptName: script.name, detail });
    } catch (e) {
      // アクターが既に切れている場合は握りつぶす
    }
  }
}
