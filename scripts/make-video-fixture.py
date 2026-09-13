"""Deterministic moving/disappearing/jumping watermark with an audio track."""
from pathlib import Path
import json
import subprocess
import cv2
import numpy as np

directory = Path(__file__).resolve().parents[1]/'data/video-test'
directory.mkdir(parents=True, exist_ok=True)
writer = cv2.VideoWriter(str(directory/'silent.mp4'), cv2.VideoWriter_fourcc(*'mp4v'), 8, (320, 240))
expected = []
for i in range(24):
    frame = np.zeros((240, 320, 3), np.uint8)
    for y in range(240):
        frame[y] = (70+y//4, 110+y//5, 150+y//6)
    x, y = (25+i*3, 40+i*2) if i < 16 else (215-(i-16)*3, 160)
    region = None if 8 <= i <= 10 else dict(x=x/320, y=y/240, w=76/320, h=26/240)
    if region:
        cv2.putText(frame, 'WM-7', (x+2, y+19), cv2.FONT_HERSHEY_SIMPLEX, .65, (255,255,255), 2, cv2.LINE_AA)
    expected.append(region)
    writer.write(frame)
writer.release()
subprocess.run(['ffmpeg','-y','-v','error','-i',str(directory/'silent.mp4'),'-f','lavfi','-i','sine=frequency=440:duration=3','-map','0:v','-map','1:a','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',str(directory/'moving.mp4')],check=True)
(directory/'expected.json').write_text(json.dumps(expected))
print(directory/'moving.mp4')
