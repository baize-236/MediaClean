# Local LaMa model

## 模型说明 / Model information

权重不随源码分发。安装 Python 依赖后，运行 `.venv\Scripts\python.exe scripts/download-model.py` 从下列上游下载并校验。也可手动下载到 `models/big-lama.pt`，再运行脚本复核校验值。下载需要联网，后续素材推理在本机进行。

Weights are not distributed with source. After installing Python dependencies, run `.venv\Scripts\python.exe scripts/download-model.py` to download and verify the upstream file below. You can also place it at `models/big-lama.pt` manually and rerun verification. Downloading needs Internet access; subsequent media inference is local.

模型遵循上游适用条款，项目 MIT 不重新授权权重。CPU 推理会缩放大选区，可能损失细节；不能保证还原被遮挡的原始内容。

Weights retain their upstream terms; the project MIT license does not relicense them. CPU inference scales large regions, potentially losing detail; original hidden content cannot be guaranteed.

CPU TorchScript weights from:
https://github.com/enesmsahin/simple-lama-inpainting/releases/download/v0.1.0/big-lama.pt

Downloaded SHA256:
7ba7aa7ac37a4d41fdbbeba3a2af7ead18058552997e3a3cd1a3b2210c9e6b4c

Original research/code: https://github.com/advimman/lama
Wrapper/source: https://github.com/enesmsahin/simple-lama-inpainting

Inference runs offline using the project `.venv` Python 3.11 environment.
PyTorch 2.6.0 CPU, NumPy 1.26.4, Pillow 11.3.0, psutil 7.0.0.
The selected region is processed with surrounding context capped at 512 pixels
on the longest side. Only selected pixels are composited into the full-size output.
Each queued job starts a separate process, releasing model memory when finished.
Large selected regions lose detail when scaled down. This is a CPU memory/quality tradeoff.
