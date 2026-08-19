/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * ユーザースクリプトの ==UserScript== ブロックを解析する。
 *
 * 対応する書式は Greasemonkey / Tampermonkey / Violentmonkey 共通の形:
 *
 *   // ==UserScript==
 *   // @name        Example
 *   // @match       https://example.com/*
 *   // @run-at      document-end
 *   // ==/UserScript==
 *
 * 既存スクリプトとの互換性が目的なので、知らないキーは捨てずに
 * extras に残す。将来 GM API を足すときに参照する。
 */

// ブロック全体を取り出す。先頭のコメント行以外に現れることは想定しない。
const BLOCK_RE =
  /\/\/\s*==UserScript==\s*\n([\s\S]*?)\n\s*\/\/\s*==\/UserScript==/;

// 1 行分。"// @key value" の形。value は省略可（@noframes など）。
const LINE_RE = /^\s*\/\/\s*@([\w-]+)\s*(.*)$/;

// 複数回書けるキー。単一値のキーと区別する。
const MULTI_KEYS = new Set([
  "match",
  "include",
  "exclude",
  "exclude-match",
  "require",
  "resource",
  "grant",
  "connect",
]);

const VALID_RUN_AT = new Set([
  "document-start",
  "document-end",
  "document-idle",
]);

export const MetadataParser = {
  /**
   * @param {string} code スクリプト全文
   * @returns {object|null} メタデータ。ブロックが無ければ null
   */
  parse(code) {
    const block = BLOCK_RE.exec(code);
    if (!block) {
      return null;
    }

    const meta = {
      name: "",
      namespace: "",
      version: "",
      description: "",
      match: [],
      include: [],
      exclude: [],
      require: [],
      resource: [],
      grant: [],
      connect: [],
      runAt: "document-idle",
      noframes: false,
      // GM_info.scriptMetaStr 用に生のブロックを保持する
      metaStr: block[0],
      extras: {},
    };

    for (const line of block[1].split("\n")) {
      const m = LINE_RE.exec(line);
      if (!m) {
        continue;
      }
      const key = m[1].toLowerCase();
      const value = m[2].trim();

      switch (key) {
        case "name":
        case "namespace":
        case "version":
        case "description":
          meta[key] = value;
          break;

        case "run-at":
          // document-body など未対応の値は既定にフォールバックする。
          // 弾いてスクリプト全体を無効にするより、動かした方が実用的。
          if (VALID_RUN_AT.has(value)) {
            meta.runAt = value;
          }
          break;

        case "noframes":
          meta.noframes = true;
          break;

        // @exclude-match は @exclude と同じ扱いにする
        case "exclude-match":
          meta.exclude.push(value);
          break;

        default:
          if (MULTI_KEYS.has(key)) {
            meta[key].push(value);
          } else {
            meta.extras[key] = value;
          }
      }
    }

    // @name が無いスクリプトはファイル名で代用させるため空のまま返す。
    return meta;
  },
};
