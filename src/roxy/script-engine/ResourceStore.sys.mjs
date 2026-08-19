/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @require / @resource で参照される外部ファイルの取得とキャッシュ。
 *
 * 保存先は <profile>/roxy/resources/。URL のハッシュをファイル名にする。
 * 一度取得したら再取得しない（ライブラリは版ごとに URL が変わる前提）。
 * 手動で更新したい場合は about:roxy の「キャッシュを消去」を使う。
 *
 * 取得は必ず親プロセスで行い、Cookie は送らない。@require の URL は
 * スクリプト作者が指定するものなので、利用者の認証情報を渡す理由がない。
 */

// setTimeout はシステムモジュールのグローバルに無い
import {
  setTimeout,
  clearTimeout,
} from "resource://gre/modules/Timer.sys.mjs";

const DIR_NAME = "resources";

// 1 ファイルあたりの上限。ライブラリとしては十分で、
// 巨大なファイルで親プロセスのメモリを圧迫させない。
const MAX_BYTES = 10 * 1024 * 1024;

const FETCH_TIMEOUT_MS = 30 * 1000;

export const ResourceStore = {
  _dir: null,
  /** @type {Map<string, Promise<object>>} URL → 取得結果 */
  _cache: new Map(),

  get dir() {
    if (!this._dir) {
      this._dir = PathUtils.join(PathUtils.profileDir, "roxy", DIR_NAME);
    }
    return this._dir;
  },

  /**
   * URL からキャッシュファイル名を作る。
   * URL をそのままファイル名にすると長さと使用可能文字の制限に触れる。
   */
  _keyFor(url) {
    const hasher = Cc["@mozilla.org/security/hash;1"].createInstance(
      Ci.nsICryptoHash
    );
    hasher.init(Ci.nsICryptoHash.SHA256);
    const bytes = new TextEncoder().encode(url);
    hasher.update(bytes, bytes.length);
    // base64 はファイル名に使えない文字を含むので置き換える
    return hasher
      .finish(true)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  },

  _pathFor(url) {
    return PathUtils.join(this.dir, `${this._keyFor(url)}.json`);
  },

  /**
   * 取得してキャッシュする。既にあればそれを返す。
   *
   * @returns {Promise<object>} { ok, text, mime, error }
   */
  async fetchCached(url) {
    if (this._cache.has(url)) {
      return this._cache.get(url);
    }
    const promise = this._load(url);
    this._cache.set(url, promise);
    return promise;
  },

  async _load(url) {
    const path = this._pathFor(url);

    // ディスクのキャッシュ
    try {
      const text = await IOUtils.readUTF8(path);
      const parsed = JSON.parse(text);
      if (parsed?.ok) {
        return parsed;
      }
    } catch (e) {
      // 未取得なら落ちてくる。ここでは何もしない。
    }

    const result = await this._download(url);

    // 失敗はキャッシュしない。次回の起動で取り直せるようにする。
    if (result.ok) {
      try {
        await IOUtils.makeDirectory(this.dir, { createAncestors: true });
        await IOUtils.writeUTF8(path, JSON.stringify(result), {
          tmpPath: `${path}.tmp`,
        });
      } catch (e) {
        console.error(`[Roxy] リソースの保存に失敗しました (${url}):`, e);
      }
    }
    return result;
  },

  async _download(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return { ok: false, error: `不正な URL です: ${url}` };
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      return { ok: false, error: `対応していないスキームです: ${url}` };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(parsed.href, {
        // スクリプト作者が指定した URL なので、利用者の Cookie は送らない
        credentials: "omit",
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}` };
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_BYTES) {
        return {
          ok: false,
          error: `大きすぎます (${buffer.byteLength} バイト、上限 ${MAX_BYTES})`,
        };
      }

      return {
        ok: true,
        url,
        text: new TextDecoder().decode(buffer),
        mime: (response.headers.get("content-type") || "text/plain").split(
          ";"
        )[0],
      };
    } catch (e) {
      return { ok: false, error: String(e) };
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * キャッシュを消す。@require の中身を取り直したいときに使う。
   */
  async clear() {
    this._cache.clear();
    try {
      await IOUtils.remove(this.dir, { recursive: true, ignoreAbsent: true });
    } catch (e) {
      console.error("[Roxy] リソースキャッシュを消せません:", e);
    }
  },
};
