"""Check real UI-generated output, including erased and untouched areas."""
from pathlib import Path
import numpy as np
from PIL import Image

directory = Path(__file__).resolve().parents[1] / 'data' / 'editor-test'
before = np.asarray(Image.open(directory / 'before.png').convert('RGB'))
after = np.asarray(Image.open(directory / 'after.png').convert('RGB'))
assert before.shape == after.shape == (512, 512, 3)
changed = np.any(before != after, axis=2)
# Conservative bounds enclose both selected areas; everything else must be exact.
allowed = np.zeros((512, 512), dtype=bool)
allowed[100:310, 100:310] = True
allowed[330:405, 340:485] = True
assert not changed[~allowed].any(), 'Unselected pixels changed'
assert not changed[198:211, 198:211].any(), 'Erased center changed'
assert changed[120:160, 120:180].any(), 'Rectangle was not repaired'
assert changed[355:382, 365:440].any(), 'Brush area was not repaired'
print('PASS: dimensions, untouched pixels, erased center, rectangle and brush repair')
