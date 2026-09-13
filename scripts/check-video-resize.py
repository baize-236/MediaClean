import json
from pathlib import Path
import subprocess
from video_repair import metadata, track, repair_video

root = Path(__file__).resolve().parents[1]
source = root/'data/uploads/25540acf-f8e4-427f-8833-a932a3c214b8.mp4'
info = metadata(str(source))
assert (info['width'],info['height']) == (1080,1620)
tasks = json.loads((root/'data/tasks.json').read_text(encoding='utf-8'))
options = next(t['options'] for t in tasks if t['options']['mode']=='video-repair')
result = track({'input':str(source),'options':options})
assert len(result['frames']) > 0
# Exercise the actual resized encoder and model on a located frame.
index = next((i for i,f in enumerate(result['frames']) if f['region']), None)
assert index == 0, 'First frame not located; review tracking before using this sample'
result['frames'] = result['frames'][:1]
output = root/'data/video-test/resize-check.mp4'
metrics = repair_video({'input':str(source),'output':str(output),'tracking':result,'options':options,'preview':True})
probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(output)]))
video = next(s for s in probe['streams'] if s['codec_type']=='video')
assert (video['width'],video['height']) == (1080,1620)
print(json.dumps({'result':'PASS','source':[info['sourceWidth'],info['sourceHeight']],'output':[video['width'],video['height']],'realModel':True}))
