"""Generate ProofLab's original raster PWA icons. Requires Pillow (build-time only)."""
from pathlib import Path
from PIL import Image, ImageDraw
for size in (192, 512):
    scale = size / 100
    image = Image.new('RGB', (size, size), '#175CD3')
    draw = ImageDraw.Draw(image)
    def box(coords):
        return tuple(round(v * scale) for v in coords)
    # A geometric P and small check mark, with safe padding for maskable icons.
    draw.rounded_rectangle(box((27, 22, 70, 58)), radius=round(16*scale), fill='white')
    draw.rectangle(box((27, 38, 38, 78)), fill='white')
    draw.rounded_rectangle(box((38, 33, 59, 47)), radius=round(6*scale), fill='#175CD3')
    draw.line([(round(x*scale),round(y*scale)) for x,y in ((47,70),(56,79),(77,56))], fill='#9FE5CF', width=round(7*scale))
    image.save(Path('public') / f'icon-{size}.png', optimize=True)
