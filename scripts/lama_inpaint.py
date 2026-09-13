"""CPU-only LaMa inference. JSON request on stdin, metrics on stdout.

Weights: enesmsahin/simple-lama-inpainting v0.1.0 TorchScript big-lama.
Only the selected rectangle is composited back; no remote requests occur.
"""
import json
import math
import sys
import time
from pathlib import Path

started = time.perf_counter()
import numpy as np
import psutil
import torch
from PIL import Image, ImageOps, ImageDraw


def process(request):
    torch.set_num_threads(4)
    torch.set_num_interop_threads(1)
    model_path = Path(__file__).resolve().parents[1] / 'models' / 'big-lama.pt'
    if not model_path.is_file():
        raise ValueError('LaMa model is missing; install models/big-lama.pt')
    image = ImageOps.exif_transpose(Image.open(request['input']))
    image.load()
    alpha = image.getchannel('A') if 'A' in image.getbands() else None
    image = image.convert('RGB')
    width, height = image.size
    r = request['region']
    values = [float(r[k]) for k in ('x', 'y', 'w', 'h')]
    if not all(math.isfinite(v) for v in values):
        raise ValueError('Invalid selection')
    x, y, w, h = values
    if min(x, y) < 0 or min(w, h) <= 0 or x+w > 1.001 or y+h > 1.001:
        raise ValueError('Invalid selection')
    x0, y0 = int(x*width), int(y*height)
    x1, y1 = min(width, math.ceil((x+w)*width)), min(height, math.ceil((y+h)*height))
    if x1 <= x0 or y1 <= y0:
        raise ValueError('Empty selection')
    full_mask = Image.new('L', image.size, 0)
    pen = ImageDraw.Draw(full_mask)
    if request.get('strokes'):
        for stroke in request['strokes']:
            points = [(round(p[0]*(width-1)), round(p[1]*(height-1))) for p in stroke['points']]
            if stroke['type'] == 'rect':
                a, b = points
                pen.rectangle((min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])), fill=255)
            else:
                diameter = max(1, round(stroke['size']*min(width, height)))
                color = 0 if stroke['type'] == 'erase' else 255
                pen.line(points, fill=color, width=diameter)
                radius = diameter/2
                for px, py in points:
                    pen.ellipse((px-radius, py-radius, px+radius, py+radius), fill=color)
        bounds = full_mask.getbbox()
        if not bounds:
            raise ValueError('选区为空，请重新涂抹需要修复的区域')
        x0, y0, x1, y1 = bounds
    else:
        pen.rectangle((x0, y0, x1-1, y1-1), fill=255)
    margin = max(96, min(256, max(x1-x0, y1-y0)))
    box = (max(0, x0-margin), max(0, y0-margin), min(width, x1+margin), min(height, y1+margin))
    patch = image.crop(box)
    mask_image = full_mask.crop(box)
    size = patch.size
    scale = min(1, 512/max(size))
    resized = (max(8, round(size[0]*scale)), max(8, round(size[1]*scale)))
    rgb = np.asarray(patch.resize(resized, Image.Resampling.LANCZOS)).astype(np.float32)/255
    binary = np.asarray(mask_image.resize(resized, Image.Resampling.NEAREST)) > 0
    ph, pw = (-rgb.shape[0]) % 8, (-rgb.shape[1]) % 8
    rgb = np.pad(rgb, ((0, ph), (0, pw), (0, 0)), mode='symmetric')
    binary = np.pad(binary, ((0, ph), (0, pw)), mode='symmetric')
    model = torch.jit.load(str(model_path), map_location='cpu').eval()
    loaded = time.perf_counter()
    with torch.inference_mode():
        result = model(torch.from_numpy(rgb.transpose(2, 0, 1).copy())[None], torch.from_numpy(binary.astype(np.float32))[None, None])
    inference_seconds = time.perf_counter()-loaded
    result = result[0].permute(1, 2, 0).numpy()[:resized[1], :resized[0]]
    restored = Image.fromarray(np.clip(result*255, 0, 255).astype(np.uint8)).resize(size, Image.Resampling.LANCZOS)
    image.paste(restored, (box[0], box[1]), mask_image)
    if alpha is not None:
        image.putalpha(alpha)
    image.save(request['output'], format='PNG')
    mem = psutil.Process().memory_info()
    return {'engine': 'lama-cpu', 'width': width, 'height': height,
            'inferenceSeconds': round(inference_seconds, 2),
            'totalSeconds': round(time.perf_counter()-started, 2),
            'peakMemoryMB': round(getattr(mem, 'peak_wset', mem.rss)/1024**2),
            'patchSize': list(resized)}


if __name__ == '__main__':
    try:
        print(json.dumps(process(json.load(sys.stdin))))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
