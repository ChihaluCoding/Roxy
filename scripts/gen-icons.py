#!/usr/bin/env python3
"""assets/merlin-icon.ico から Merlin のブランディング画像一式を生成する。

元画像を差し替えたら、このスクリプトを再実行して apply-patches.sh を回す。
生成物（src/branding/ 配下の画像）もコミットする。ビルド環境に Pillow が
無くても apply-patches.sh が動くようにするため。
"""
import base64
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "merlin-icon.ico"
OUT = ROOT / "src" / "branding"

SVG_LOGO = """<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 256 256" width="256" height="256">
  <image width="256" height="256" xlink:href="data:image/png;base64,{b64}"/>
</svg>
"""

SVG_WORDMARK = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 64" width="320" height="64">
  <text x="0" y="32" fill="context-fill, currentColor" font-family="Segoe UI, Arial, sans-serif"
        font-weight="600" font-size="44" dominant-baseline="central">Merlin</text>
</svg>
"""


def load_source():
    im = Image.open(SRC)
    if hasattr(im, "ico"):          # ico からは最大サイズを取り出す
        im.size = max(im.ico.sizes())
    return im.convert("RGBA")


def scaled(base, size, pad_ratio=0.0):
    """size x size に収める。pad_ratio ぶん内側に余白を取る（タイル用）。"""
    inner = max(int(size * (1 - 2 * pad_ratio)), 1)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.paste(base.resize((inner, inner), Image.LANCZOS), ((size - inner) // 2,) * 2)
    return img


def main():
    base = load_source()
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

    print(f"生成完了: {OUT}  (元画像: {SRC.name})")


if __name__ == "__main__":
    main()
