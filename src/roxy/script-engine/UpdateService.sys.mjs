/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * ユーザースクリプトの自動更新。
 *
 * @updateURL（無ければ @downloadURL）からメタデータを取得して @version を
 * 比較し、新しければ @downloadURL の本文で置き換える。
 *
 * この機能は「配布元を信頼して任意のコードを実行し続ける」ことを意味する。
 * 取り違えを防ぐため、置き換え前に @name と @namespace の一致を確認する。
 * リダイレクト先が別のスクリプトにすり替わっていた場合に気づける。
 */

import {
  setTimeout,
  clearTimeout,
} from "resource://gre/modules/Timer.sys.mjs";

import { MetadataParser } from "resource:///modules/roxy/MetadataParser.sys.mjs";
import { ScriptStore } from "resource:///modules/roxy/ScriptStore.sys.mjs";

const PREF_ENABLED = "roxy.script.update.enabled";
const PREF_INTERVAL_HOURS = "roxy.script.update.interval_hours";
const PREF_LAST_CHECK = "roxy.script.update.last_check";

// 起動直後は他の初期化と競合させたくないので少し待つ
const STARTUP_DELAY_MS = 60 * 1000;

const FETCH_TIMEOUT_MS = 30 * 1000;
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * 版の比較。"1.10" > "1.9" を正しく判定する必要があるため、
 * 文字列比較ではなく数値の並びとして比べる。
 *
 * @returns {number} a が新しければ 1、古ければ -1、同じなら 0
 */
export function compareVersions(a, b) {
  const parse = v =>
    String(v ?? "")
      .split(/[.\-+_]/)
      .map(part => {
        const n = parseInt(part, 10);
        return Number.isFinite(n) ? n : 0;
      });

  const av = parse(a);
  const bv = parse(b);
  const len = Math.max(av.length, bv.length);

  for (let i = 0; i < len; i++) {
    const x = av[i] ?? 0;
    const y = bv[i] ?? 0;
    if (x !== y) {
      return x > y ? 1 : -1;
    }
  }
  return 0;
}

async function fetchText(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return { ok: false, error: `不正な URL です: ${url}` };
  }
  // 更新は取得した内容をそのまま実行することになるため、
  // 経路が保護されない http は受け付けない。
  if (parsed.protocol !== "https:") {
    return { ok: false, error: `https 以外は更新に使えません: ${url}` };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), FETCH_TIMEOUT_MS);
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
}

export const UpdateService = {
  _timer: null,
  _engine: null,
  _running: false,

  /**
   * @param {object} engine ScriptEngine。循環 import を避けるため受け取る。
   */
  init(engine) {
    this._engine = engine;
    if (!Services.prefs.getBoolPref(PREF_ENABLED, true)) {
      return;
    }
    this._timer = setTimeout(() => this._tick(), STARTUP_DELAY_MS);
  },

  _intervalMs() {
    const hours = Services.prefs.getIntPref(PREF_INTERVAL_HOURS, 24);
    return Math.max(1, hours) * 60 * 60 * 1000;
  },

  async _tick() {
    if (Services.prefs.getBoolPref(PREF_ENABLED, true)) {
      await this.checkAll();
    }
    this._timer = setTimeout(() => this._tick(), this._intervalMs());
  },

  /**
   * 全スクリプトの更新を確認する。
   *
   * @returns {Promise<object>} { checked, updated, failed, results }
   */
  async checkAll() {
    if (this._running) {
      return { checked: 0, updated: 0, failed: 0, results: [] };
    }
    this._running = true;
    try {
      const scripts = await this._engine.listScriptsRaw();
      const results = [];
      let updated = 0;
      let failed = 0;

      for (const script of scripts) {
        const res = await this.checkOne(script);
        results.push(res);
        if (res.updated) {
          updated++;
        }
        if (res.error) {
          failed++;
        }
      }

      Services.prefs.setStringPref(PREF_LAST_CHECK, String(Date.now()));
      if (updated) {
        await this._engine.reload();
      }
      console.log(
        `[Roxy] 更新確認: ${scripts.length} 件中 ${updated} 件更新、${failed} 件失敗`
      );
      return { checked: scripts.length, updated, failed, results };
    } finally {
      this._running = false;
    }
  },

  /**
   * 1 件分の更新確認。
   *
   * @returns {Promise<object>} { id, updated, version, error, skipped }
   */
  async checkOne(script) {
    const meta = script.meta;
    const downloadURL = meta.downloadURL || "";
    const updateURL = meta.updateURL || downloadURL;

    if (!updateURL || !downloadURL) {
      return { id: script.id, skipped: true };
    }

    // 1) メタデータだけ取って版を比べる
    const head = await fetchText(updateURL);
    if (!head.ok) {
      return { id: script.id, error: `更新確認に失敗: ${head.error}` };
    }

    const remoteMeta = MetadataParser.parse(head.text);
    if (!remoteMeta) {
      return { id: script.id, error: "更新元に ==UserScript== がありません" };
    }

    if (compareVersions(remoteMeta.version, meta.version) <= 0) {
      return { id: script.id, updated: false, version: meta.version };
    }

    // 2) 本体を取得する
    const body =
      updateURL === downloadURL ? head : await fetchText(downloadURL);
    if (!body.ok) {
      return { id: script.id, error: `本体の取得に失敗: ${body.error}` };
    }

    const newMeta = MetadataParser.parse(body.text);
    if (!newMeta) {
      return { id: script.id, error: "取得した本体が解析できません" };
    }

    // 3) 別物へのすり替えを防ぐ
    if (
      newMeta.name !== meta.name ||
      newMeta.namespace !== meta.namespace
    ) {
      return {
        id: script.id,
        error:
          `更新元のスクリプトが別物です（${meta.name} / ${meta.namespace} → ` +
          `${newMeta.name} / ${newMeta.namespace}）。更新を中止しました。`,
      };
    }

    await ScriptStore.writeCode(script.id, body.text);
    console.log(
      `[Roxy] 更新: ${script.name} ${meta.version} → ${newMeta.version}`
    );
    return {
      id: script.id,
      updated: true,
      version: newMeta.version,
      previous: meta.version,
    };
  },

  get lastCheck() {
    const raw = Services.prefs.getStringPref(PREF_LAST_CHECK, "");
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  },
};
