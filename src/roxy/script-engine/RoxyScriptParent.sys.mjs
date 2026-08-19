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

export class RoxyScriptParent extends JSWindowActorParent {
  async receiveMessage(message) {
    switch (message.name) {
      case "Roxy:GetScripts": {
        const { url, isTopLevel } = message.data;
        return ScriptEngine.getMatchingScripts(url, isTopLevel);
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
}
