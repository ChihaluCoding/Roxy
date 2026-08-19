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

  const edit = document.createElement("button");
  edit.textContent = "編集";
  edit.addEventListener("click", () => openEditor(script));
  actions.appendChild(edit);

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
    if (
      !Services.prompt.confirm(
        window,
        "Roxy",
        `「${script.name}」を削除します。元に戻せません。`
      )
    ) {
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


// ---- エディタ ----
//
// DevTools 同梱の CodeMirror 5 を既定テーマで使う（Tampermonkey と同じ構成）。
// 読み込めなかった場合は素の textarea として動作する。

let editingId = null;

/** 新規作成中は true。保存するまでファイルは存在しない。 */
let isNewScript = false;

/** 未保存の変更があるか */
let isDirty = false;

/** CodeMirror インスタンス。読み込みに失敗した場合は null。 */
let cm = null;

function initEditorWidget() {
  if (typeof CodeMirror === "undefined") {
    console.warn(
      "[Roxy] CodeMirror を読み込めませんでした。textarea で代替します。"
    );
    return;
  }

  cm = CodeMirror.fromTextArea(el("editor"), {
    mode: "javascript",
    // 配色は lib/codemirror.css の cm-s-default に任せる。
    // mozilla テーマは色定義を持たないので指定しない。
    theme: "default",
    lineNumbers: true,
    lineWrapping: false,
    matchBrackets: true,
    autoCloseBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
    extraKeys: {
      "Ctrl-S": () => saveEditor(),
      "Cmd-S": () => saveEditor(),
      Tab: editor => editor.execCommand("indentMore"),
      "Shift-Tab": editor => editor.execCommand("indentLess"),
      "Ctrl-/": editor => editor.execCommand("toggleComment"),
      "Cmd-/": editor => editor.execCommand("toggleComment"),
    },
  });
  cm.on("change", markDirty);
}

function getEditorValue() {
  return cm ? cm.getValue() : el("editor").value;
}

function setEditorValue(text) {
  if (cm) {
    cm.setValue(text);
    // hidden 解除の直後は寸法が確定しないため、描画後に測り直させる
    requestAnimationFrame(() => {
      cm.refresh();
      cm.focus();
    });
  } else {
    el("editor").value = text;
    el("editor").focus();
  }
  isDirty = false;
}

function markDirty() {
  if (!isDirty) {
    isDirty = true;
    setEditorStatus("未保存の変更があります");
  }
}

function setEditorStatus(text, isError = false) {
  const node = el("editor-status");
  node.textContent = text;
  node.classList.toggle("is-error", isError);
}

function showPanel(name) {
  el("panel-userscripts").hidden = name !== "userscripts";
  el("panel-editor").hidden = name !== "editor";
}

/** CodeMirror が無いときだけ Tab / Ctrl+S を自前で処理する */
function handleEditorKeydown(event) {
  if (cm) {
    return;
  }
  if (event.key === "Tab") {
    event.preventDefault();
    const ta = event.target;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    ta.value = value.slice(0, s) + "  " + value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + 2;
    markDirty();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "s") {
    event.preventDefault();
    saveEditor();
  }
}

async function openEditor(script) {
  editingId = script.id;
  isNewScript = false;
  el("editor-name").textContent = script.id;
  setEditorStatus("");
  showPanel("editor");

  try {
    setEditorValue(await ScriptEngine.getCode(script.id));
  } catch (e) {
    console.error("[Roxy] スクリプトを読めません:", e);
    setEditorStatus("読み込みに失敗しました", true);
  }
}

/**
 * 新規作成。ひな形を開くだけで、ファイルは保存時に作る。
 */
function openNewEditor() {
  editingId = null;
  isNewScript = true;
  el("editor-name").textContent = "新規スクリプト（未保存）";
  showPanel("editor");
  setEditorValue(ScriptEngine.newScriptTemplate);
  setEditorStatus("保存すると @name からファイル名を決めます");
}

async function saveEditor() {
  if (!editingId && !isNewScript) {
    return;
  }
  setEditorStatus("保存中…");
  try {
    const code = getEditorValue();
    const res = isNewScript
      ? await ScriptEngine.createScript(code)
      : await ScriptEngine.saveScript(editingId, code);

    if (!res.ok) {
      // 解析に失敗した場合は保存されていない。理由をそのまま見せる。
      setEditorStatus(res.error, true);
      return;
    }

    if (isNewScript) {
      editingId = res.id;
      isNewScript = false;
      el("editor-name").textContent = res.id;
    }
    isDirty = false;
    setEditorStatus("保存しました。ページを再読み込みすると反映されます。");
  } catch (e) {
    console.error("[Roxy] 保存に失敗しました:", e);
    setEditorStatus("保存に失敗しました", true);
  }
}

/**
 * 編集画面を離れてよいか確認する。
 */
function confirmLeaveEditor() {
  if (!isDirty) {
    return true;
  }
  return Services.prompt.confirm(
    window,
    "Roxy",
    "未保存の変更があります。破棄して一覧に戻りますか？"
  );
}

function init() {
  el("dir-path").textContent = ScriptEngine.scriptsDir;

  initEditorWidget();

  el("reload").addEventListener("click", refresh);
  el("new-script").addEventListener("click", openNewEditor);
  el("editor-save").addEventListener("click", saveEditor);
  el("editor").addEventListener("keydown", handleEditorKeydown);
  el("editor").addEventListener("input", markDirty);

  el("editor-back").addEventListener("click", () => {
    if (!confirmLeaveEditor()) {
      return;
    }
    editingId = null;
    isNewScript = false;
    isDirty = false;
    showPanel("userscripts");
    refresh();
  });

  el("open-folder").addEventListener("click", () => {
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(ScriptEngine.scriptsDir);
    file.launch();
  });

  // CodeMirror が有効かどうかを一覧側に出す。
  // 期待した見た目にならないとき、原因の切り分けに使う。
  refresh()
    .then(() => {
      if (!cm) {
        setStatus(
          `${el("script-list").children.length} 件 ／ 簡易エディタ（CodeMirror 未読込）`
        );
      }
    })
    .catch(e => {
      console.error("[Roxy] about:roxy の初期化に失敗しました:", e);
      setStatus("読み込みに失敗しました");
    });
}

document.addEventListener("DOMContentLoaded", init, { once: true });
