#!/usr/bin/env python3
"""assets/roxy-icon.ico から Roxy のブランディング画像一式を生成する。

元画像を差し替えたら、このスクリプトを再実行して apply-patches.sh を回す。
生成物（src/branding/ 配下の画像）もコミットする。ビルド環境に Pillow が
無くても apply-patches.sh が動くようにするため。
"""
import base64
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
OUT = ROOT / "src" / "branding"


def source_path():
    """assets/ の中で最も新しい版（roxy-icon-vN.ico の N 最大）を使う。

    無ければ roxy-icon.ico にフォールバックする。
    """
    versioned = []
    for f in ASSETS.glob("roxy-icon-v*.ico"):
        digits = "".join(c for c in f.stem.split("-v")[-1] if c.isdigit())
        if digits:
            versioned.append((int(digits), f))
    if versioned:
        return max(versioned)[1]
    return ASSETS / "roxy-icon.ico"


SRC = source_path()

SVG_LOGO = """<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 256 256" width="256" height="256">
  <image width="256" height="256" xlink:href="data:image/png;base64,{b64}"/>
</svg>
"""

SVG_WORDMARK = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 64" width="320" height="64">
  <text x="0" y="32" fill="context-fill, currentColor" font-family="Segoe UI, Arial, sans-serif"
        font-weight="600" font-size="44" dominant-baseline="central">Roxy</text>
</svg>
"""


def load_frames():
    """ico に含まれる全サイズを {辺の長さ: 画像} で返す。"""
    im = Image.open(SRC)
    if not hasattr(im, "ico"):
        return {im.size[0]: im.convert("RGBA")}
    frames = {}
    for size in im.ico.sizes():
        if size[0] != size[1]:      # 正方形でないフレームは使わない
            continue
        im.size = size
        frames[size[0]] = im.copy().convert("RGBA")
    return frames


def best_frame(frames, size):
    """要求サイズ以上で最も近いフレームを選ぶ（無ければ最大）。"""
    candidates = [n for n in frames if n >= size] or [max(frames)]
    return frames[min(candidates)]


def scaled(frames, size, pad_ratio=0.0):
    """size x size に収める。pad_ratio ぶん内側に余白を取る（タイル用）。

    元 ico が持つサイズはそのまま使い、縮小による劣化を避ける。
    """
    inner = max(int(size * (1 - 2 * pad_ratio)), 1)
    src = best_frame(frames, inner)
    if src.size[0] != inner:
        src = src.resize((inner, inner), Image.LANCZOS)
    if inner == size:
        return src
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.paste(src, ((size - inner) // 2,) * 2)
    return img


def main():
    base = load_frames()
    OUT.mkdir(parents=True, exist_ok=True)
    content = OUT / "content"
    content.mkdir(exist_ok=True)

    for n in (16, 22, 24, 32, 48, 64, 128, 256):
        scaled(base, n).save(OUT / f"default{n}.png")

    # Windows アプリアイコン（マルチサイズ）
    scaled(base, 256).save(
        OUT / "firefox.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    scaled(base, 64).save(OUT / "firefox64.ico", sizes=[(64, 64)])

    # スタートメニューのタイル。周囲に余白が要る
    scaled(base, 150, pad_ratio=0.18).save(OUT / "VisualElements_70.png")
    scaled(base, 300, pad_ratio=0.18).save(OUT / "VisualElements_150.png")

    # about: ページ
    scaled(base, 192).save(content / "about-logo.png")
    scaled(base, 384).save(content / "about-logo@2x.png")
    scaled(base, 512).save(content / "about.png")

    # 元画像がベクタではないため、SVG にはラスタを data URI で埋め込む
    buf = BytesIO()
    scaled(base, 256).save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    (content / "about-logo.svg").write_text(SVG_LOGO.format(b64=b64), encoding="utf-8")
    (content / "about-wordmark.svg").write_text(SVG_WORDMARK, encoding="utf-8")
    (content / "firefox-wordmark.svg").write_text(SVG_WORDMARK, encoding="utf-8")

    print("生成完了: %s" % OUT)
    print("  元画像: %s  収録サイズ: %s" % (SRC.name, sorted(base)))


if __name__ == "__main__":
    main()
