/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Script Engine の特権側アクター。
 *
 * content 側からの要求はすべてここを通す。M3 で GM_xmlhttpRequest や
 * GM_setValue を足すときも、実処理はこのプロセスで行うこと。
 * content にファイル入出力やクロスオリジン通信をさせてはいけない。
 */

import { ScriptEngine } from "resource:///modules/roxy/ScriptEngine.sys.mjs";
import { ValueStore } from "resource:///modules/roxy/ValueStore.sys.mjs";
import { XhrService } from "resource:///modules/roxy/XhrService.sys.mjs";

export class RoxyScriptParent extends JSWindowActorParent {
  async receiveMessage(message) {
    switch (message.name) {
      case "Roxy:GetScripts": {
        const { url, isTopLevel } = message.data;
        return ScriptEngine.getMatchingScripts(url, isTopLevel);
      }

      case "Roxy:GM:SetValue": {
        const { scriptId, key, value } = message.data;
        await ValueStore.set(scriptId, key, value);
        return null;
      }

      case "Roxy:GM:DeleteValue": {
        const { scriptId, key } = message.data;
        await ValueStore.delete(scriptId, key);
        return null;
      }

      case "Roxy:GM:Xhr": {
        const { details, requestId, scriptId } = message.data;
        const script = ScriptEngine.getScriptById(scriptId);
        return XhrService.request(details, {
          requestId,
          connect: script?.meta?.connect ?? [],
          pageHost: this._pageHost(),
          scriptName: script?.name ?? scriptId,
        });
      }

      case "Roxy:GM:AbortXhr": {
        XhrService.abort(message.data.requestId);
        return null;
      }

      case "Roxy:GM:OpenInTab": {
        const { url, active } = message.data;
        const win = Services.wm.getMostRecentWindow("navigator:browser");
        if (!win) {
          return null;
        }
        // ユーザースクリプト由来の URL なので、必ずコンテンツ権限で開く。
        win.openWebLinkIn(url, "tab", {
          inBackground: !active,
          triggeringPrincipal:
            Services.scriptSecurityManager.createNullPrincipal({}),
        });
        return null;
      }

      case "Roxy:GM:SetClipboard": {
        const { text } = message.data;
        const helper = Cc[
          "@mozilla.org/widget/clipboardhelper;1"
        ].getService(Ci.nsIClipboardHelper);
        helper.copyString(String(text));
        return null;
      }

      case "Roxy:Log": {
        // content 側の例外を親のコンソールに集約する。
        // ページのコンソールだと気づかないため。
        const { scriptName, detail } = message.data;
        console.error(`[Roxy UserScript] ${scriptName}: ${detail}`);
        return null;
      }
    }
    return null;
  }

  /**
   * リクエスト元ページのホスト。@connect の判定に使う。
   */
  _pageHost() {
    try {
      return this.browsingContext?.currentWindowGlobal?.documentURI?.host ?? "";
    } catch (e) {
      return "";
    }
  }
}
