/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @match / @include / @exclude の照合。
 *
 * 二種類の書式を扱う。混同しやすいので分けて実装する。
 *
 *   @match   … Chrome の match pattern。scheme://host/path の三部構成で、
 *               ワイルドカードの位置に厳密な規則がある。
 *   @include … 旧 Greasemonkey 形式。単純なグロブか /正規表現/。
 *               規則が緩く、意図せず広く一致しやすい。
 */

const MATCH_PATTERN_RE = /^(\*|https?|file|ftp):\/\/([^/]*)(\/.*)$/;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * match pattern を正規表現に変換する。不正なパターンは null。
 */
function compileMatchPattern(pattern) {
  if (pattern === "<all_urls>") {
    return /^(https?|file|ftp):\/\/.*$/;
  }

  const m = MATCH_PATTERN_RE.exec(pattern);
  if (!m) {
    return null;
  }
  const [, scheme, host, path] = m;

  const schemeRe = scheme === "*" ? "(https?)" : escapeRegExp(scheme);

  let hostRe;
  if (host === "*") {
    hostRe = "[^/]+";
  } else if (host.startsWith("*.")) {
    // *.example.com は example.com 自身にも一致する（Chrome の仕様）
    hostRe = "(?:[^/]+\\.)?" + escapeRegExp(host.slice(2));
  } else if (host.includes("*")) {
    // ホスト中の * は先頭の "*." 以外では認められない
    return null;
  } else {
    hostRe = escapeRegExp(host);
  }

  const pathRe = escapeRegExp(path).replace(/\\\*/g, ".*");

  return new RegExp(`^${schemeRe}://${hostRe}${pathRe}$`);
}

/**
 * @include / @exclude の値を正規表現に変換する。
 */
function compileInclude(pattern) {
  // /.../ 形式なら正規表現として扱う
  if (pattern.length > 2 && pattern.startsWith("/") && pattern.endsWith("/")) {
    try {
      return new RegExp(pattern.slice(1, -1));
    } catch (e) {
      return null;
    }
  }
  if (pattern === "*") {
    return /^.*$/;
  }
  // グロブ。* のみワイルドカードとして扱う
  return new RegExp("^" + escapeRegExp(pattern).replace(/\\\*/g, ".*") + "$");
}

export const UrlMatcher = {
  /**
   * メタデータをもとに、コンパイル済みの照合器を作る。
   * ページ遷移ごとに正規表現を作り直さないよう、スクリプト読み込み時に一度だけ呼ぶ。
   */
  compile(meta) {
    const compileAll = (list, fn) =>
      list.map(fn).filter(re => re !== null);

    return {
      match: compileAll(meta.match, compileMatchPattern),
      include: compileAll(meta.include, compileInclude),
      exclude: compileAll(meta.exclude, compileInclude),
    };
  },

  /**
   * @param {object} rules compile() の戻り値
   * @param {string} url 対象 URL
   * @returns {boolean}
   */
  test(rules, url) {
    // @exclude が最優先。一致したら他を見ない。
    if (rules.exclude.some(re => re.test(url))) {
      return false;
    }

    const hasPositive = rules.match.length || rules.include.length;
    if (!hasPositive) {
      // 対象指定が一切ないスクリプトは、全ページで動かさない。
      // Greasemonkey は全ページ扱いにするが、事故が大きいので安全側に倒す。
      return false;
    }

    return (
      rules.match.some(re => re.test(url)) ||
      rules.include.some(re => re.test(url))
    );
  },
};
