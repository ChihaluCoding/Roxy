/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Script Engine の親プロセス側の中枢。
 *
 * 役割は 3 つ。
 *   1. JSActor の登録
 *   2. スクリプトの保持と、URL に対する絞り込み
 *   3. 特権が要る処理の受け口（GM API は M3 でここに足す）
 *
 * content プロセスにはスクリプト本文しか渡さない。ファイル入出力や
 * クロスオリジン通信は必ずこちら側で行う。
 */

import { MetadataParser } from "resource:///modules/roxy/MetadataParser.sys.mjs";
import { ScriptStore } from "resource:///modules/roxy/ScriptStore.sys.mjs";
import { ValueStore } from "resource:///modules/roxy/ValueStore.sys.mjs";
import { UrlMatcher } from "resource:///modules/roxy/UrlMatcher.sys.mjs";

const ACTOR_NAME = "RoxyScript";
const PREF_ENABLED = "roxy.script.enabled";

export const ScriptEngine = {
  _initialized: false,
  _scripts: [],
  _loadPromise: null,

  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    if (!Services.prefs.getBoolPref(PREF_ENABLED, true)) {
      console.log("[Roxy] Script Engine は無効です");
      return;
    }

    this._registerActor();

    // 起動を遅らせないよう、読み込みは待たずに走らせる。
    // 最初のページが先に来ても getMatchingScripts() 側で待てる。
    this.reload();

    console.log("[Roxy] Script Engine を起動しました");
  },

  _registerActor() {
    try {
      ChromeUtils.registerWindowActor(ACTOR_NAME, {
        parent: {
          esModuleURI: "resource:///modules/roxy/RoxyScriptParent.sys.mjs",
        },
        child: {
          esModuleURI: "resource:///modules/roxy/RoxyScriptChild.sys.mjs",
          events: {
            // @run-at の 3 タイミングに対応する DOM イベント
            DOMDocElementInserted: {}, // document-start
            DOMContentLoaded: {}, // document-end
            load: { capture: true }, // document-idle
          },
        },
        allFrames: true,
      });
    } catch (e) {
      // 既に登録済みの場合もここに来る（開発中の再入対策）
      console.error("[Roxy] アクターの登録に失敗しました:", e);
    }
  },

  /**
   * ディスクから読み直す。M4 の管理 UI から呼ぶ想定。
   */
  reload() {
    this._loadPromise = ScriptStore.loadAll()
      .then(scripts => {
        this._scripts = scripts;
        console.log(`[Roxy] ユーザースクリプト ${scripts.length} 件を読み込みました`);
        return scripts;
      })
      .catch(e => {
        console.error("[Roxy] スクリプトの読み込みに失敗しました:", e);
        this._scripts = [];
        return [];
      });
    return this._loadPromise;
  },

  /**
   * URL に一致するスクリプトを、content へ渡せる形にして返す。
   *
   * rules（正規表現）は構造化クローンできないので送らない。
   * 照合は必ず親側で完結させる。
   */
  async getMatchingScripts(url, isTopLevel) {
    if (this._loadPromise) {
      await this._loadPromise;
    }

    const result = [];
    for (const script of this._scripts) {
      if (!script.enabled) {
        continue;
      }
      if (script.meta.noframes && !isTopLevel) {
        continue;
      }
      if (!UrlMatcher.test(script.rules, url)) {
        continue;
      }
      // GM_getValue は同期 API なので、実行前に値一式を渡しておく。
      const values = await ValueStore.load(script.id);

      result.push({
        id: script.id,
        name: script.name,
        code: script.code,
        runAt: script.meta.runAt,
        grant: script.meta.grant,
        meta: script.meta,
        metaStr: script.metaStr,
        values,
        handlerName: Services.prefs.getStringPref(
          "roxy.script.handler_name",
          "Violentmonkey"
        ),
        engineVersion: Services.appinfo.version,
      });
    }
    return result;
  },

  /**
   * ID からスクリプト定義を引く。@connect の判定などに使う。
   */
  getScriptById(scriptId) {
    return this._scripts.find(s => s.id === scriptId) ?? null;
  },

  // ---- about:roxy から呼ばれる操作 ----

  /**
   * 一覧表示用。スクリプト本文は重いので含めない。
   */
  async listScripts() {
    if (this._loadPromise) {
      await this._loadPromise;
    }
    return this._scripts.map(s => ({
      id: s.id,
      name: s.name,
      enabled: s.enabled,
      path: s.path,
      version: s.meta.version,
      description: s.meta.description,
      runAt: s.meta.runAt,
      match: s.meta.match,
      include: s.meta.include,
      grant: s.meta.grant,
    }));
  },

  async setEnabled(scriptId, enabled) {
    await ScriptStore.setEnabled(scriptId, enabled);
    await this.reload();
  },

  /**
   * 編集用に本文を読む。
   */
  async getCode(scriptId) {
    return ScriptStore.readCode(scriptId);
  },

  /**
   * 保存して即座に反映する。
   *
   * @returns {Promise<object>} { ok, error } 解析に失敗した場合は保存しない
   */
  async saveScript(scriptId, code) {
    // ==UserScript== が無いと読み込み時に無視される。
    // 保存してから「動かない」と悩まないよう、ここで弾く。
    if (!MetadataParser.parse(code)) {
      return {
        ok: false,
        error: "==UserScript== ブロックが見つかりません。保存しませんでした。",
      };
    }
    await ScriptStore.writeCode(scriptId, code);
    await this.reload();
    return { ok: true };
  },

  /**
   * 新規スクリプトのひな形。ファイルは作らない。
   */
  get newScriptTemplate() {
    return ScriptStore.newScriptTemplate;
  },

  /**
   * 本文を指定して新規作成する。保存時に初めてファイルができる。
   * ファイル名は @name から作る（無ければ new-script）。
   *
   * @returns {Promise<object>} { ok, id, error }
   */
  async createScript(code) {
    const meta = MetadataParser.parse(code);
    if (!meta) {
      return {
        ok: false,
        error: "==UserScript== ブロックが見つかりません。保存しませんでした。",
      };
    }
    const id = await ScriptStore.create(meta.name || "new-script", code);
    await this.reload();
    return { ok: true, id };
  },

  async removeScript(scriptId) {
    await ScriptStore.remove(scriptId);
    await this.reload();
  },

  /**
   * スクリプト置き場のパス。UI の「フォルダを開く」用。
   */
  get scriptsDir() {
    return ScriptStore.dir;
  },
};
