"""Validate real benchmark: dimensions, unchanged exterior, changed interior."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
root = Path(__file__).resolve().parents[1]
report = json.loads((root/'data/lama-benchmark/report.json').read_text(encoding='utf-8'))
before = np.asarray(Image.open(report['input']).convert('RGB'))
after = np.asarray(Image.open(report['output']).convert('RGB'))
assert before.shape == after.shape
h, w = before.shape[:2]
r = report['region']
import math
x0, y0 = int(r['x']*w), int(r['y']*h)
x1, y1 = min(w, math.ceil((r['x']+r['w'])*w)), min(h, math.ceil((r['y']+r['h'])*h))
outside = np.ones((h,w), dtype=bool)
outside[y0:y1,x0:x1] = False
assert np.array_equal(before[outside], after[outside]), 'Unselected pixels changed'
assert not np.array_equal(before[~outside], after[~outside]), 'Selection was not repaired'
print('PASS: original dimensions, unchanged pixels outside selection, actual model changes inside selection')
