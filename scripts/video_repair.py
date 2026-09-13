"""Local seeded template tracking and CPU LaMa video repair; not ProPainter."""
import json
import math
import subprocess
import sys
import tempfile
import time
from pathlib import Path
import cv2
import numpy as np


def emit(**value):
    print(json.dumps(value), flush=True)


def metadata(path):
    data = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]))
    stream = next(s for s in data['streams'] if s['codec_type'] == 'video')
    def rate(value):
        a, b = map(float, value.split('/'))
        return a/b if b else 0
    fps = rate(stream['avg_frame_rate'])
    nominal = rate(stream['r_frame_rate'])
    duration = float(data['format'].get('duration', 0))
    if not 0 < duration <= 30.1 or not 1 <= fps <= 60.1:
        raise ValueError('本机视频 AI 修复暂支持 30 秒以内、1–60 fps 的短视频，请先截取片段')
    if abs(nominal-fps) > max(.1, fps*.01):
        raise ValueError('暂不支持可变帧率视频，请先转为固定帧率 MP4')
    capture = cv2.VideoCapture(path)
    ok, frame = capture.read()
    capture.release()
    if not ok:
        raise ValueError('无法解码视频')
    height, width = frame.shape[:2]
    scale = min(1, 1920/max(width, height), 1080/min(width, height))
    output_width = max(2, int(width*scale)//2*2)
    output_height = max(2, int(height*scale)//2*2)
    return dict(width=output_width, height=output_height, sourceWidth=width, sourceHeight=height,
                resized=(output_width != width or output_height != height), fps=fps, duration=duration)


def pixel_box(region, width, height):
    x = max(0, min(width-2, round(region['x']*width)))
    y = max(0, min(height-2, round(region['y']*height)))
    w = max(2, min(width-x, round(region['w']*width)))
    h = max(2, min(height-y, round(region['h']*height)))
    return x, y, w, h


def edges(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(cv2.GaussianBlur(gray, (3, 3), 0), cv2.CV_32F)


def track(request):
    info = metadata(request['input'])
    reference = float(request['options'].get('referenceTime', 0))
    if reference >= info['duration']:
        raise ValueError('参考时间超出视频时长')
    scale = min(1, 640/max(info['width'], info['height']))
    width, height = round(info['width']*scale), round(info['height']*scale)
    cap = cv2.VideoCapture(request['input'])
    try:
        cap.set(cv2.CAP_PROP_POS_FRAMES, round(reference*info['fps']))
        ok, seed = cap.read()
        if not ok:
            raise ValueError('无法读取参考帧，请选择更早的时间')
        seed = cv2.resize(seed, (width, height))
        x, y, w, h = pixel_box(request['options']['region'], width, height)
        template = edges(seed)[y:y+h, x:x+w].copy()
        if min(w, h) < 5 or w*h > width*height*.3 or float(template.std()) < 2:
            raise ValueError('请紧贴清晰水印框选，避免选区过大、过小或没有可识别的文字图案')
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        frames, previous = [], None
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if len(frames) >= 1805:
                raise ValueError('视频帧数超出本机处理限制')
            feature = edges(cv2.resize(frame, (width, height)))
            scores = cv2.matchTemplate(feature, template, cv2.TM_CCOEFF_NORMED)
            _, score, _, location = cv2.minMaxLoc(scores)
            px, py = location
            # A second spatially distinct match indicates ambiguity, not certainty.
            competing = scores.copy()
            competing[max(0, py-h//2):min(scores.shape[0], py+h//2+1), max(0, px-w//2):min(scores.shape[1], px+w//2+1)] = -1
            second = float(competing.max())
            reliable = score >= .52 and score-second >= .055
            if previous and score >= .45:
                lx, ly = previous
                area = scores[max(0, ly-12):min(scores.shape[0], ly+13), max(0, lx-12):min(scores.shape[1], lx+13)]
                if area.size:
                    _, local_score, _, pos = cv2.minMaxLoc(area)
                    if local_score >= max(.52, score-.025) and reliable:
                        px, py = max(0, lx-12)+pos[0], max(0, ly-12)+pos[1]
            previous = (px, py) if reliable else None
            frames.append({'time': round((len(frames))/info['fps'], 5), 'confidence': round(float(score), 3),
                           'region': {'x': px/width, 'y': py/height, 'w': w/width, 'h': h/height} if reliable else None})
            if len(frames) % 10 == 0:
                emit(progress=min(95, round(len(frames)/(info['duration']*info['fps'])*95)))
        if not frames:
            raise ValueError('视频没有可读取帧')
        matched = sum(f['region'] is not None for f in frames)
        return {**info, 'frames': frames, 'matched': matched, 'uncertain': len(frames)-matched, 'engine': 'template-tracking', 'referenceTime': reference}
    finally:
        cap.release()


class LamaVideo:
    def __init__(self):
        import torch
        self.torch = torch
        torch.set_num_threads(4)
        torch.set_num_interop_threads(1)
        self.model = torch.jit.load(str(Path(__file__).resolve().parents[1]/'models/big-lama.pt'), map_location='cpu').eval()

    def repair(self, frame, region):
        height, width = frame.shape[:2]
        x, y, w, h = pixel_box(region, width, height)
        # Slight expansion covers antialiasing surrounding the detected template.
        x0, y0, x1, y1 = max(0, x-2), max(0, y-2), min(width, x+w+2), min(height, y+h+2)
        margin = max(32, min(96, max(w, h)))
        bx, by, ex, ey = max(0, x0-margin), max(0, y0-margin), min(width, x1+margin), min(height, y1+margin)
        patch = cv2.cvtColor(frame[by:ey, bx:ex], cv2.COLOR_BGR2RGB)
        mask = np.zeros(patch.shape[:2], np.uint8)
        mask[y0-by:y1-by, x0-bx:x1-bx] = 255
        ratio = min(1, 256/max(patch.shape[:2]))
        size = (max(8, round(patch.shape[1]*ratio)), max(8, round(patch.shape[0]*ratio)))
        rgb = cv2.resize(patch, size).astype(np.float32)/255
        binary = cv2.resize(mask, size, interpolation=cv2.INTER_NEAREST).astype(np.float32)/255
        ph, pw = (-size[1]) % 8, (-size[0]) % 8
        rgb = np.pad(rgb, ((0, ph), (0, pw), (0, 0)), mode='symmetric')
        binary = np.pad(binary, ((0, ph), (0, pw)), mode='symmetric')
        with self.torch.inference_mode():
            value = self.model(self.torch.from_numpy(rgb.transpose(2, 0, 1).copy())[None], self.torch.from_numpy(binary.copy())[None, None])
        value = value[0].permute(1, 2, 0).numpy()[:size[1], :size[0]]
        value = cv2.resize(np.clip(value*255, 0, 255).astype(np.uint8), (ex-bx, ey-by))
        output = frame.copy()
        output[y0:y1, x0:x1] = cv2.cvtColor(value, cv2.COLOR_RGB2BGR)[y0-by:y1-by, x0-bx:x1-bx]
        full_mask = np.zeros((height, width), np.uint8)
        full_mask[y0:y1, x0:x1] = 255
        return output, full_mask


def stabilize(frame, output, mask, previous):
    if previous is None:
        return output
    old, repaired, old_mask = previous
    height, width = frame.shape[:2]
    scale = min(1, 320/max(width, height))
    size = (round(width*scale), round(height*scale))
    current_gray = cv2.cvtColor(cv2.resize(frame, size), cv2.COLOR_BGR2GRAY)
    old_gray = cv2.cvtColor(cv2.resize(old, size), cv2.COLOR_BGR2GRAY)
    # Reject scene cuts before attempting temporal blending.
    if np.mean(cv2.absdiff(current_gray, old_gray)) > 18:
        return output
    flow = cv2.calcOpticalFlowFarneback(current_gray, old_gray, None, .5, 3, 15, 3, 5, 1.2, 0)
    flow = cv2.resize(flow, (width, height)) / scale
    xx, yy = np.meshgrid(np.arange(width, dtype=np.float32), np.arange(height, dtype=np.float32))
    mx, my = xx+flow[:, :, 0], yy+flow[:, :, 1]
    warped = cv2.remap(repaired, mx, my, cv2.INTER_LINEAR)
    valid = cv2.remap(old_mask, mx, my, cv2.INTER_NEAREST) > 0
    use = (mask > 0) & valid & (np.mean(np.abs(warped.astype(np.float32)-output), axis=2) < 25)
    output[use] = (output[use].astype(np.float32)*.75+warped[use]*.25).astype(np.uint8)
    return output


def repair_video(request):
    info = metadata(request['input'])
    tracking = request['tracking']
    frames = tracking['frames']
    count = min(len(frames), max(1, round(3*info['fps']))) if request.get('preview') else len(frames)
    if not any(f['region'] for f in frames[:count]):
        raise ValueError('所选片段没有可信的水印位置，请重新框选跟踪')
    model = LamaVideo()
    cap = cv2.VideoCapture(request['input'])
    previous, processed = None, 0
    # Encode via a pipe, with no unbounded collection of decoded frames in memory.
    with tempfile.TemporaryDirectory(prefix='mediaclean-video-') as temporary:
        silent = str(Path(temporary)/'silent.mp4')
        with open(Path(temporary)/'ffmpeg.log', 'w+b') as log:
            command = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f"{info['width']}x{info['height']}", '-r', str(info['fps']), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', {'high':'18', 'balanced':'22', 'small':'28'}[request['options']['quality']], '-pix_fmt', 'yuv420p', silent]
            encoder = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=log)
            try:
                for index, item in enumerate(frames[:count]):
                    ok, frame = cap.read()
                    if not ok:
                        raise ValueError('视频解码提前结束，请重新分析')
                    if frame.shape[1] != info['width'] or frame.shape[0] != info['height']:
                        frame = cv2.resize(frame, (info['width'], info['height']), interpolation=cv2.INTER_AREA)
                    if item['region']:
                        output, mask = model.repair(frame, item['region'])
                        output = stabilize(frame, output, mask, previous)
                        previous = (frame, output, mask)
                        processed += 1
                    else:
                        output, previous = frame, None
                    encoder.stdin.write(output.tobytes())
                    emit(progress=min(94, 5+round((index+1)/count*89)))
                encoder.stdin.close()
                if encoder.wait(timeout=120) != 0:
                    log.seek(0)
                    raise ValueError('视频编码失败：'+log.read().decode(errors='replace')[-500:])
            finally:
                cap.release()
                if encoder.poll() is None:
                    encoder.kill()
                encoder.wait()
            # Optional original audio; the same frame-zero origin is used for both streams.
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', silent, '-i', request['input'], '-map', '0:v:0', '-map', '1:a:0?', '-c:v', 'copy', '-c:a', 'aac', '-t', str(count/info['fps']), '-movflags', '+faststart', request['output']], check=True, capture_output=True, timeout=120)
    return {**info, 'engine':'lama-video-cpu', 'frames':count, 'repairedFrames':processed, 'skippedFrames':count-processed, 'preview':bool(request.get('preview'))}


if __name__ == '__main__':
    try:
        started = time.perf_counter()
        request = json.load(sys.stdin)
        cv2.setNumThreads(2)
        result = track(request) if request['action'] == 'track' else repair_video(request)
        result['totalSeconds'] = round(time.perf_counter()-started, 2)
        emit(result=result)
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
