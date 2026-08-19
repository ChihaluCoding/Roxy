/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * about:roxy の画面制御。
 *
 * 特権ページとして親プロセスで動くため、ScriptEngine を直接呼べる。
 * ここに重い処理やファイル操作を書かず、必ずモジュール側へ委譲すること。
 */

/* eslint-env mozilla/browser-window */

const { ScriptEngine } = ChromeUtils.importESModule(
  "resource:///modules/roxy/ScriptEngine.sys.mjs"
);

const el = id => document.getElementById(id);

function setStatus(text) {
  el("status").textContent = text;
}

/**
 * テキストは必ず textContent で入れる。
 * スクリプトの @name や @description は信用できない入力なので、
 * innerHTML を使うと about:roxy 上で任意コードが動く。
 */
function chip(text) {
  const span = document.createElement("span");
  span.className = "chip";
  span.textContent = text;
  return span;
}

function renderScript(script) {
  const li = document.createElement("li");
  li.className = "script" + (script.enabled ? "" : " is-disabled");

  const name = document.createElement("p");
  name.className = "script-name";
  name.textContent = script.name;
  if (script.version) {
    const ver = document.createElement("span");
    ver.className = "script-version";
    ver.textContent = `v${script.version}`;
    name.appendChild(ver);
  }
  li.appendChild(name);

  const desc = document.createElement("p");
  desc.className = "script-desc";
  desc.textContent = script.description || script.id;
  li.appendChild(desc);

  const actions = document.createElement("div");
  actions.className = "script-actions";

  const toggle = document.createElement("button");
  toggle.textContent = script.enabled ? "無効にする" : "有効にする";
  toggle.addEventListener("click", async () => {
    toggle.disabled = true;
    await ScriptEngine.setEnabled(script.id, !script.enabled);
    await refresh();
  });
  actions.appendChild(toggle);

  const del = document.createElement("button");
  del.textContent = "削除";
  del.addEventListener("click", async () => {
    // 取り消せない操作なので必ず確認する
    if (!Services.prompt.confirm(window, "Roxy", `「${script.name}」を削除します。元に戻せません。`)) {
      return;
    }
    del.disabled = true;
    await ScriptEngine.removeScript(script.id);
    await refresh();
  });
  actions.appendChild(del);

  li.appendChild(actions);

  const meta = document.createElement("div");
  meta.className = "script-meta";
  meta.appendChild(chip(script.runAt));
  for (const pattern of [...script.match, ...script.include]) {
    meta.appendChild(chip(pattern));
  }
  for (const g of script.grant) {
    meta.appendChild(chip(`@grant ${g}`));
  }
  li.appendChild(meta);

  return li;
}

async function refresh() {
  setStatus("読み込み中…");
  await ScriptEngine.reload();
  const scripts = await ScriptEngine.listScripts();

  const list = el("script-list");
  list.textContent = "";
  for (const script of scripts) {
    list.appendChild(renderScript(script));
  }

  el("empty").hidden = scripts.length > 0;
  setStatus(`${scripts.length} 件`);
}

function init() {
  el("dir-path").textContent = ScriptEngine.scriptsDir;

  el("reload").addEventListener("click", refresh);

  el("open-folder").addEventListener("click", () => {
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(ScriptEngine.scriptsDir);
    file.launch();
  });

  refresh().catch(e => {
    console.error("[Roxy] about:roxy の初期化に失敗しました:", e);
    setStatus("読み込みに失敗しました");
  });
}

document.addEventListener("DOMContentLoaded", init, { once: true });
