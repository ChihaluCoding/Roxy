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
// @name:ja のようにロケール付きのキーがあるため、":" 以降を分けて取る。
// 分けずに書くと "@name:vi ..." を「キー name、値 ':vi ...'」と誤読し、
// 最後に現れた言語で名前が上書きされてしまう。
const LINE_RE = /^\s*\/\/\s*@([\w-]+)(?::([\w-]+))?(?:\s+(.*))?$/;

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

/**
 * @name:ja のようなロケール付きの値から、UI 言語に合うものを選ぶ。
 * "ja-JP" に対して "ja" のような前方一致も見る。
 */
function applyLocale(meta) {
  let tags = [];
  try {
    tags = Services.locale.appLocalesAsBCP47.map(t => t.toLowerCase());
  } catch (e) {
    tags = [];
  }

  for (const key of ["name", "description"]) {
    const table = meta.localized[key];
    if (!table) {
      continue;
    }
    const found = tags.find(
      tag => table[tag] ?? table[tag.split("-")[0]] ?? null
    );
    if (found) {
      meta[key] = table[found] ?? table[found.split("-")[0]] ?? meta[key];
    }
  }
}

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
      // 自動更新用。updateURL はメタデータだけの軽いファイルを指すことが多い。
      updateURL: "",
      downloadURL: "",
      noframes: false,
      // GM_info.scriptMetaStr 用に生のブロックを保持する
      metaStr: block[0],
      // ロケール付きの値。{ name: { ja: "...", en: "..." } }
      localized: {},
      extras: {},
    };

    for (const line of block[1].split("\n")) {
      const m = LINE_RE.exec(line);
      if (!m) {
        continue;
      }
      const key = m[1].toLowerCase();
      const locale = m[2] ? m[2].toLowerCase() : null;
      const value = (m[3] ?? "").trim();

      // ロケール付きは基本のキーを上書きせず、別に控える
      if (locale) {
        (meta.localized[key] ??= {})[locale] = value;
        continue;
      }

      switch (key) {
        case "name":
        case "namespace":
        case "version":
        case "description":
          meta[key] = value;
          break;

        case "updateurl":
          meta.updateURL = value;
          break;

        case "downloadurl":
          meta.downloadURL = value;
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

    // 表示に使う名前と説明は、UI の言語に合わせて選ぶ。
    // 一致するものが無ければ基本のキーをそのまま使う。
    applyLocale(meta);

    // @name が無いスクリプトはファイル名で代用させるため空のまま返す。
    return meta;
  },
};
