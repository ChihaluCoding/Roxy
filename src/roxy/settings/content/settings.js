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

/**
 * 直近の実行時エラーを表示する。
 *
 * 構文チェックでは綴りの誤り（coolnsole など）は検出できない。
 * それらは実行して初めて分かるので、結果をここに出す。
 */
function renderError(script) {
  const box = document.createElement("div");
  box.className = "script-error";

  const head = document.createElement("div");
  head.className = "script-error-head";

  const label = document.createElement("span");
  const when = new Date(script.lastError.time).toLocaleTimeString();
  label.textContent =
    script.errorCount > 1
      ? `実行時エラー ${script.errorCount} 件（最新 ${when}）`
      : `実行時エラー（${when}）`;
  head.appendChild(label);

  const clear = document.createElement("button");
  clear.textContent = "消去";
  clear.addEventListener("click", async () => {
    ScriptEngine.clearErrors(script.id);
    await refresh();
  });
  head.appendChild(clear);
  box.appendChild(head);

  const detail = document.createElement("pre");
  detail.className = "script-error-detail";
  // エラー文言はページ由来の文字列を含みうるので必ず textContent で入れる
  detail.textContent = script.lastError.detail;
  box.appendChild(detail);

  if (script.lastError.url) {
    const where = document.createElement("div");
    where.className = "script-error-url";
    where.textContent = script.lastError.url;
    box.appendChild(where);
  }

  return box;
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

  if (script.lastError) {
    li.appendChild(renderError(script));
  }

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

  const failing = scripts.filter(s => s.errorCount > 0).length;
  setStatus(
    failing ? `${scripts.length} 件（エラー ${failing} 件）` : `${scripts.length} 件`
  );
}


// ---- エディタ ----
//
// DevTools 同梱の CodeMirror 5 を既定テーマで使う（Tampermonkey と同じ構成）。
// バンドルに含まれるアドオン（検索・折りたたみ・現在行・一致語強調など）を
// 有効にしている。読み込めなかった場合は素の textarea として動作する。

let editingId = null;

/** 新規作成中は true。保存するまでファイルは存在しない。 */
let isNewScript = false;

/** 未保存の変更があるか */
let isDirty = false;

/** CodeMirror インスタンス。読み込みに失敗した場合は null。 */
let cm = null;

/** 構文チェックで付けた行ハイライトの解除用 */
let lintMark = null;

function initEditorWidget() {
  if (typeof CodeMirror === "undefined") {
    console.warn(
      "[Roxy] CodeMirror を読み込めませんでした。textarea で代替します。"
    );
    el("ed-engine").textContent = "簡易エディタ（CodeMirror 未読込）";
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
    styleActiveLine: true,
    showTrailingSpace: true,
    // 選択した語と同じ語を薄く強調する
    highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: true },
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
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
      "Ctrl-J": () => jumpToLine(),
      "Shift-Alt-F": () => reindentAll(),
      "Alt-Up": editor => editor.execCommand("swapLineUp"),
      "Alt-Down": editor => editor.execCommand("swapLineDown"),
      "Ctrl-D": editor => editor.execCommand("deleteLine"),
    },
  });

  cm.on("change", () => {
    markDirty();
    clearLintMark();
  });
  cm.on("cursorActivity", updateStatusBar);
  updateStatusBar();
}

/** ステータスバーの行桁表示を更新する */
function updateStatusBar() {
  if (!cm) {
    return;
  }
  const pos = cm.getCursor();
  el("ed-pos").textContent = `${pos.line + 1}:${pos.ch + 1}`;
  el("ed-lines").textContent = `${cm.lineCount()} 行`;
}

function getEditorValue() {
  return cm ? cm.getValue() : el("editor").value;
}

function setEditorValue(text) {
  clearLintMark();
  if (cm) {
    cm.setValue(text);
    cm.clearHistory();
    // hidden 解除の直後は寸法が確定しないため、描画後に測り直させる
    requestAnimationFrame(() => {
      cm.refresh();
      cm.focus();
      updateStatusBar();
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
  el("panel-install").hidden = name !== "install";
}

// ---- 配布サイトからのインストール ----

let pendingInstall = null;

/**
 * 確認画面を出す。ここでは保存しない。
 */
async function showInstall(url) {
  showPanel("install");
  el("install-status").textContent = "取得しています…";
  el("install-code").textContent = "";
  el("install-meta").textContent = "";
  el("install-warn").hidden = true;
  el("install-accept").disabled = true;

  let info;
  try {
    info = await ScriptEngine.prepareInstall(url);
  } catch (e) {
    console.error("[Roxy] インストールの準備に失敗しました:", e);
    el("install-status").textContent = "取得に失敗しました";
    return;
  }

  if (!info.ok) {
    el("install-status").textContent = info.error;
    el("install-status").classList.add("is-error");
    el("install-name").textContent = "インストールできません";
    el("install-source").textContent = url;
    return;
  }

  pendingInstall = info;
  el("install-status").textContent = "";
  el("install-status").classList.remove("is-error");
  el("install-accept").disabled = false;

  el("install-name").textContent = info.meta.version
    ? `${info.meta.name} v${info.meta.version}`
    : info.meta.name;
  el("install-desc").textContent = info.meta.description || "";
  el("install-source").textContent = info.url;

  const meta = el("install-meta");
  meta.textContent = "";
  meta.appendChild(chip(info.meta.runAt));
  for (const p of [...info.meta.match, ...info.meta.include]) {
    meta.appendChild(chip(p));
  }
  for (const g of info.meta.grant) {
    meta.appendChild(chip(`@grant ${g}`));
  }
  for (const r of info.meta.require) {
    meta.appendChild(chip(`@require ${r}`));
  }
  for (const c of info.meta.connect) {
    meta.appendChild(chip(`@connect ${c}`));
  }

  // 注意を促す点をまとめて出す。権限の要求は見落としやすい。
  const warnings = [];
  if (info.existing) {
    warnings.push(
      `同名のスクリプトが既にあります（v${info.existing.version}）。上書きされます。`
    );
  }
  if (info.meta.grant.includes("GM_xmlhttpRequest")) {
    warnings.push(
      "GM_xmlhttpRequest を要求しています。外部サイトへ通信します。"
    );
  }
  if (info.meta.require.length) {
    warnings.push(
      `外部ライブラリを ${info.meta.require.length} 件読み込みます。`
    );
  }
  if (warnings.length) {
    const box = el("install-warn");
    box.textContent = "";
    for (const w of warnings) {
      const line = document.createElement("div");
      line.textContent = w;
      box.appendChild(line);
    }
    box.hidden = false;
  }

  // コードは信用できない入力なので必ず textContent で入れる
  el("install-code").textContent = info.code;
}

async function acceptInstall() {
  if (!pendingInstall) {
    return;
  }
  el("install-accept").disabled = true;
  el("install-status").textContent = "インストールしています…";
  try {
    const res = await ScriptEngine.install(
      pendingInstall.url,
      pendingInstall.code,
      pendingInstall.existing?.id ?? null
    );
    if (!res.ok) {
      el("install-status").textContent = res.error;
      el("install-status").classList.add("is-error");
      el("install-accept").disabled = false;
      return;
    }
    pendingInstall = null;
    // 一覧へ戻して結果を見せる
    window.location.hash = "";
    showPanel("userscripts");
    await refresh();
  } catch (e) {
    console.error("[Roxy] インストールに失敗しました:", e);
    el("install-status").textContent = "インストールに失敗しました";
    el("install-accept").disabled = false;
  }
}

/**
 * about:roxy#install=<URL> で開かれたときにインストール画面を出す。
 */
function handleHash() {
  const m = /^#install=(.+)$/.exec(window.location.hash);
  if (!m) {
    return false;
  }
  showInstall(decodeURIComponent(m[1]));
  return true;
}

// ---- ツールバーの操作 ----

function runCommand(name) {
  if (cm) {
    cm.focus();
    cm.execCommand(name);
  }
}

/**
 * 指定行へ移動する。
 * CodeMirror の jump-to-line アドオンはバンドルに含まれないため自前で実装する。
 */
function jumpToLine() {
  if (!cm) {
    return;
  }
  const input = { value: String(cm.getCursor().line + 1) };
  const ok = Services.prompt.prompt(
    window,
    "Roxy",
    `行番号を入力してください (1〜${cm.lineCount()})`,
    input,
    null,
    {}
  );
  if (!ok) {
    return;
  }
  const line = parseInt(input.value, 10);
  if (!Number.isFinite(line) || line < 1) {
    return;
  }
  const target = Math.min(line, cm.lineCount()) - 1;
  cm.setCursor({ line: target, ch: 0 });
  // 画面の中央付近に来るようにする
  cm.scrollIntoView({ line: target, ch: 0 }, 200);
  cm.focus();
}

/** 全体を自動インデントし直す */
function reindentAll() {
  if (!cm) {
    return;
  }
  const cursor = cm.getCursor();
  cm.operation(() => {
    for (let i = 0; i < cm.lineCount(); i++) {
      cm.indentLine(i, "smart");
    }
  });
  cm.setCursor(cursor);
  cm.focus();
  setEditorStatus("整形しました");
}

function foldAll(fold) {
  if (!cm) {
    return;
  }
  cm.operation(() => {
    for (let i = 0; i < cm.lineCount(); i++) {
      cm.foldCode({ line: i, ch: 0 }, null, fold ? "fold" : "unfold");
    }
  });
}

function toggleWrap() {
  if (!cm) {
    return;
  }
  const next = !cm.getOption("lineWrapping");
  cm.setOption("lineWrapping", next);
  el("ed-wrap").classList.toggle("is-active", next);
}

function clearLintMark() {
  if (lintMark) {
    lintMark.clear?.();
    lintMark = null;
  }
  if (cm) {
    for (let i = 0; i < cm.lineCount(); i++) {
      cm.removeLineClass(i, "background", "cm-error-line");
    }
  }
}

/**
 * 構文チェック。
 *
 * 検査そのものは ScriptEngine 側で行う。about:roxy の CSP では
 * new Function が遮断されるため、UI 側では解析できない。
 * モジュール側はコードを実行せず構文解析だけを行う。
 */
function lintScript() {
  if (!cm) {
    return;
  }
  clearLintMark();

  const res = ScriptEngine.checkSyntax(getEditorValue());
  if (res.ok) {
    setEditorStatus("構文エラーはありません");
    cm.focus();
    return;
  }

  if (res.line && res.line <= cm.lineCount()) {
    const target = res.line - 1;
    cm.addLineClass(target, "background", "cm-error-line");
    cm.setCursor({ line: target, ch: 0 });
    cm.scrollIntoView({ line: target, ch: 0 }, 200);
    setEditorStatus(`構文エラー ${res.line} 行目: ${res.message}`, true);
  } else {
    setEditorStatus(`構文エラー: ${res.message}`, true);
  }
  cm.focus();
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

  // ツールバー。CodeMirror 標準コマンドはそのまま呼び、
  // 無いものだけ自前実装に繋ぐ。
  el("ed-undo").addEventListener("click", () => runCommand("undo"));
  el("ed-redo").addEventListener("click", () => runCommand("redo"));
  el("ed-find").addEventListener("click", () => runCommand("find"));
  el("ed-find-next").addEventListener("click", () => runCommand("findNext"));
  el("ed-find-prev").addEventListener("click", () => runCommand("findPrev"));
  el("ed-replace").addEventListener("click", () => runCommand("replace"));
  el("ed-jump").addEventListener("click", jumpToLine);
  el("ed-reindent").addEventListener("click", reindentAll);
  el("ed-fold-all").addEventListener("click", () => foldAll(true));
  el("ed-unfold-all").addEventListener("click", () => foldAll(false));
  el("ed-lint").addEventListener("click", lintScript);
  el("ed-wrap").addEventListener("click", toggleWrap);

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

  el("clear-cache").addEventListener("click", async () => {
    setStatus("キャッシュを消去しています…");
    await ScriptEngine.clearResourceCache();
    await refresh();
  });

  el("install-cancel").addEventListener("click", () => {
    pendingInstall = null;
    window.location.hash = "";
    showPanel("userscripts");
  });
  el("install-accept").addEventListener("click", acceptInstall);
  window.addEventListener("hashchange", handleHash);

  el("check-updates").addEventListener("click", async () => {
    const button = el("check-updates");
    button.disabled = true;
    setStatus("更新を確認しています…");
    try {
      const res = await ScriptEngine.checkForUpdates();
      setStatus(
        `${res.checked} 件を確認 / ${res.updated} 件更新 / ${res.failed} 件失敗`
      );
    } catch (e) {
      console.error("[Roxy] 更新確認に失敗しました:", e);
      setStatus("更新確認に失敗しました");
    } finally {
      button.disabled = false;
      await refresh();
    }
  });

  el("restore-samples").addEventListener("click", async () => {
    setStatus("サンプルを作成しています…");
    await ScriptEngine.restoreSamples();
    await refresh();
  });

  el("open-folder").addEventListener("click", () => {
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(ScriptEngine.scriptsDir);
    file.launch();
  });

  refresh()
    .then(() => handleHash())
    .catch(e => {
      console.error("[Roxy] about:roxy の初期化に失敗しました:", e);
      setStatus("読み込みに失敗しました");
    });
}

document.addEventListener("DOMContentLoaded", init, { once: true });
