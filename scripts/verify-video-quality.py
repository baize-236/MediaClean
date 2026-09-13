from pathlib import Path
import json
import cv2
import numpy as np

directory = Path(__file__).resolve().parents[1]/'data/video-test'
expected = json.loads((directory/'expected.json').read_text())
before = cv2.VideoCapture(str(directory/'moving.mp4'))
after = cv2.VideoCapture(str(directory/'repaired.mp4'))
dirty, restored, skipped, rows = [], [], [], []
for i, region in enumerate(expected):
    ok, a = before.read()
    valid, b = after.read()
    assert ok and valid
    assert a.shape == b.shape == (240, 320, 3)
    if region:
        x, y = round(region['x']*320), round(region['y']*240)
        w, h = round(region['w']*320), round(region['h']*240)
        clean = np.zeros_like(a)
        for yy in range(240):
            clean[yy] = (70+yy//4, 110+yy//5, 150+yy//6)
        dirty.append(float(np.mean(np.abs(a[y:y+h, x:x+w].astype(float)-clean[y:y+h, x:x+w]))))
        restored.append(float(np.mean(np.abs(b[y:y+h, x:x+w].astype(float)-clean[y:y+h, x:x+w]))))
    else:
        skipped.append(float(np.mean(cv2.absdiff(a,b))))
    if i in [0, 8, 16, 23]:
        rows.append(np.concatenate([a,b],axis=1))
before.release()
after.release()
assert np.mean(restored) < np.mean(dirty)*.7, 'No meaningful repair improvement on controlled sample'
assert max(skipped) < 3, 'Uncertain frames unexpectedly modified'
cv2.imwrite(str(directory/'contact-sheet.jpg'), np.concatenate(rows,axis=0))
print(json.dumps({'result':'PASS','watermarkedMAE':round(float(np.mean(dirty)),2),'repairedMAE':round(float(np.mean(restored)),2),'skippedFrameMaxMAE':round(max(skipped),2)}))
