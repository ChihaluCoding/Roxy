#!/usr/bin/env python3
"""Merlin の暫定アイコンを生成して src/branding/ へ出力する。

正式なロゴが用意できたらこのスクリプトごと差し替える想定。
再現性のためコードで持つ（バイナリを手で置くと出所が分からなくなるため）。
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "branding"
BG_TOP, BG_BOTTOM = (78, 42, 132), (140, 82, 214)   # 深い紫 → 明るい紫
FG = (255, 255, 255, 255)

def find_font(size):
    for name in ("seguisb.ttf", "segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()

def render(size, padding_ratio=0.0):
    """角丸の紫グラデーション上に M を描く。"""
    ss = 8  # スーパーサンプリング
    s = size * ss
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))

    grad = Image.new("RGBA", (1, s))
    for y in range(s):
        t = y / max(s - 1, 1)
        grad.putpixel((0, y), tuple(
            int(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)
        ) + (255,))
    grad = grad.resize((s, s))

    mask = Image.new("L", (s, s), 0)
    pad = int(s * padding_ratio)
    ImageDraw.Draw(mask).rounded_rectangle(
        [pad, pad, s - 1 - pad, s - 1 - pad], radius=int((s - 2 * pad) * 0.22), fill=255
    )
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)
    font = find_font(int(s * 0.62))
    box = d.textbbox((0, 0), "M", font=font)
    d.text(((s - box[2] - box[0]) / 2, (s - box[3] - box[1]) / 2), "M", font=font, fill=FG)

    return img.resize((size, size), Image.LANCZOS)

def main():
    OUT.mkdir(parents=True, exist_ok=True)

    for n in (16, 22, 24, 32, 48, 64, 128, 256):
        render(n).save(OUT / f"default{n}.png")

    # Windows のアプリアイコン（マルチサイズ ico）
    render(256).save(OUT / "firefox.ico",
                     sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    render(64).save(OUT / "firefox64.ico", sizes=[(64, 64)])

    # スタートメニューのタイル。周囲に余白が要る
    for name, px in (("VisualElements_70.png", 150), ("VisualElements_150.png", 300)):
        render(px, padding_ratio=0.18).save(OUT / name)

    # about: ページのロゴ
    content = OUT / "content"
    content.mkdir(exist_ok=True)
    render(192).save(content / "about-logo.png")
    render(384).save(content / "about-logo@2x.png")
    render(512).save(content / "about.png")

    # SVG（about ページ）。PNG と違い拡大しても崩れないのでテキストで生成する
    logo_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4e2a84"/>
      <stop offset="100%" stop-color="#8c52d6"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="56" fill="url(#g)"/>
  <text x="128" y="128" fill="#fff" font-family="Segoe UI, Arial, sans-serif" font-weight="700"
        font-size="160" text-anchor="middle" dominant-baseline="central">M</text>
</svg>
"""
    wordmark_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 64" width="320" height="64">
  <text x="0" y="32" fill="context-fill, currentColor" font-family="Segoe UI, Arial, sans-serif"
        font-weight="600" font-size="44" dominant-baseline="central">Merlin</text>
</svg>
"""
    (content / "about-logo.svg").write_text(logo_svg, encoding="utf-8")
    (content / "about-wordmark.svg").write_text(wordmark_svg, encoding="utf-8")
    (content / "firefox-wordmark.svg").write_text(wordmark_svg, encoding="utf-8")

    print(f"生成完了: {OUT}")

if __name__ == "__main__":
    main()
