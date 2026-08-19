/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * GM_setValue / GM_getValue の保存層（親プロセス側）。
 *
 * 保存先は <profile>/roxy/userscripts-data/<スクリプトID>.json。
 * スクリプトごとにファイルを分けるのは、1 つが壊れても他に波及させないため。
 *
 * GM_getValue は同期 API なので、content 側から都度問い合わせることはできない。
 * スクリプト実行前に値一式を content へ渡し、以降の更新をこちらへ通知させる
 * （Violentmonkey と同じ方式）。
 */

import {
  setTimeout,
  clearTimeout,
} from "resource://gre/modules/Timer.sys.mjs";

const DIR_NAME = "userscripts-data";

// 書き込みが連続したときにディスクを叩きすぎないための遅延（ミリ秒）
const FLUSH_DELAY_MS = 300;

export const ValueStore = {
  _dir: null,
  /** @type {Map<string, object>} スクリプトID → 値の集合 */
  _cache: new Map(),
  /** @type {Map<string, number>} スクリプトID → タイマーID */
  _pending: new Map(),

  get dir() {
    if (!this._dir) {
      this._dir = PathUtils.join(PathUtils.profileDir, "roxy", DIR_NAME);
    }
    return this._dir;
  },

  _pathFor(scriptId) {
    // スクリプトIDはファイル名由来。パス区切りが混ざらないよう念のため潰す。
    const safe = scriptId.replace(/[^\w.@-]/g, "_");
    return PathUtils.join(this.dir, `${safe}.json`);
  },

  /**
   * スクリプトの値一式を返す。初回はディスクから読む。
   */
  async load(scriptId) {
    if (this._cache.has(scriptId)) {
      return this._cache.get(scriptId);
    }

    let values = {};
    try {
      const text = await IOUtils.readUTF8(this._pathFor(scriptId));
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        values = parsed;
      }
    } catch (e) {
      // 未作成なら空で始める。JSON が壊れている場合も同様に扱い、
      // 上書きせず警告だけ出す。
      if (e?.name !== "NotFoundError") {
        console.warn(`[Roxy] 値ファイルを読めません (${scriptId}):`, e);
      }
    }

    this._cache.set(scriptId, values);
    return values;
  },

  async set(scriptId, key, value) {
    const values = await this.load(scriptId);
    values[key] = value;
    this._scheduleFlush(scriptId);
  },

  async delete(scriptId, key) {
    const values = await this.load(scriptId);
    delete values[key];
    this._scheduleFlush(scriptId);
  },

  _scheduleFlush(scriptId) {
    if (this._pending.has(scriptId)) {
      return;
    }
    const timer = setTimeout(() => {
      this._pending.delete(scriptId);
      this._flush(scriptId);
    }, FLUSH_DELAY_MS);
    this._pending.set(scriptId, timer);
  },

  async _flush(scriptId) {
    const values = this._cache.get(scriptId);
    if (!values) {
      return;
    }
    try {
      await IOUtils.makeDirectory(this.dir, { createAncestors: true });
      await IOUtils.writeUTF8(
        this._pathFor(scriptId),
        JSON.stringify(values, null, 2),
        { tmpPath: `${this._pathFor(scriptId)}.tmp` }
      );
    } catch (e) {
      console.error(`[Roxy] 値の保存に失敗しました (${scriptId}):`, e);
    }
  },
};
