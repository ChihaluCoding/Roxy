/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * ユーザースクリプトの保存と読み込み。
 *
 * 保存先は <profile>/roxy/userscripts/*.user.js。
 * DB ではなく素のファイルにしているのは、手で編集でき、バックアップも
 * コピーで済むため。管理 UI（M4）もこのディレクトリを操作するだけにする。
 */

import { MetadataParser } from "resource:///modules/roxy/MetadataParser.sys.mjs";
import { UrlMatcher } from "resource:///modules/roxy/UrlMatcher.sys.mjs";

const DIR_NAME = "userscripts";

const SAMPLE_FILENAME = "roxy-hello.user.js";
const SAMPLE_CODE = `// ==UserScript==
// @name        Roxy Hello
// @namespace   roxy
// @version     1.0
// @description Script Engine と GM API の動作確認用。example.com で動く。
// @match       https://example.com/*
// @match       https://*.example.com/*
// @run-at      document-end
// @grant       GM_addStyle
// @grant       GM_setValue
// @grant       GM_getValue
// ==/UserScript==

// 起動回数を数える（GM_setValue / GM_getValue の確認）
const count = (GM_getValue("count", 0) || 0) + 1;
GM_setValue("count", count);

GM_addStyle(\`
  #roxy-banner {
    position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
    background: #5b2d8e; color: #fff; font: 14px/1.6 sans-serif;
    text-align: center; padding: 8px;
  }
\`);

const banner = document.createElement("div");
banner.id = "roxy-banner";
banner.textContent =
  \`Roxy Script Engine 動作確認 / 表示回数: \${count} / handler: \${GM_info.scriptHandler}\`;
document.documentElement.appendChild(banner);

console.log("[Roxy UserScript] GM_info =", GM_info);
`;

export const ScriptStore = {
  _dir: null,

  get dir() {
    if (!this._dir) {
      this._dir = PathUtils.join(PathUtils.profileDir, "roxy", DIR_NAME);
    }
    return this._dir;
  },

  /**
   * ディレクトリを用意し、初回のみサンプルを置く。
   */
  async ensureDir() {
    await IOUtils.makeDirectory(this.dir, { createAncestors: true });

    const children = await IOUtils.getChildren(this.dir);
    if (!children.length) {
      await IOUtils.writeUTF8(
        PathUtils.join(this.dir, SAMPLE_FILENAME),
        SAMPLE_CODE
      );
    }
  },

  /**
   * ディレクトリ内の *.user.js をすべて読み、解析して返す。
   *
   * @returns {Promise<Array<object>>} スクリプト定義の配列
   */
  async loadAll() {
    await this.ensureDir();

    const scripts = [];
    let children;
    try {
      children = await IOUtils.getChildren(this.dir);
    } catch (e) {
      console.error("[Roxy] スクリプトディレクトリを読めません:", e);
      return scripts;
    }

    for (const path of children) {
      if (!path.endsWith(".user.js")) {
        continue;
      }

      let code;
      try {
        code = await IOUtils.readUTF8(path);
      } catch (e) {
        console.error(`[Roxy] 読み込み失敗: ${path}`, e);
        continue;
      }

      const filename = PathUtils.filename(path);
      const meta = MetadataParser.parse(code);
      if (!meta) {
        console.warn(
          `[Roxy] ==UserScript== ブロックが無いため無視します: ${filename}`
        );
        continue;
      }

      scripts.push({
        id: filename,
        name: meta.name || filename,
        path,
        code,
        meta,
        metaStr: meta.metaStr,
        rules: UrlMatcher.compile(meta),
      });
    }

    return scripts;
  },
};
