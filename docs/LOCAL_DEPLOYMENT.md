# 单用户本地部署 / Single-user local deployment

无需注册、登录或额度。图片和视频功能保留，使用 CPU 推理。不要把这个无账号隔离的服务开放给多人。

No registration, login or credits. Image and video features remain available with CPU inference. Do not expose this service as a multi-user application.

## Linux（Ubuntu / Debian, x86_64）

安装 Node.js 22+、Python 3.11（含 venv）和 FFmpeg/FFprobe 后，在仓库根目录执行：

Install Node.js 22+, Python 3.11 with venv, and FFmpeg/FFprobe, then run from the repository root:

```bash
npm ci
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements-torch.txt
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python scripts/download-model.py
npm start
```

打开 / Open **http://127.0.0.1:3220**. 使用 IP 地址，不是 `localhost` / Use this IP address, not `localhost`.

Python 3.11 未安装时先安装，不要假设系统默认 Python 版本相同。默认按系统选择 `.venv/bin/python` 或 Windows 的 `.venv/Scripts/python.exe`，也可通过 `PYTHON_PATH` 指定解释器绝对路径。

Install Python 3.11 first if missing; the system Python may differ. Runtime paths select Linux or Windows automatically; `PYTHON_PATH` can override the interpreter with an absolute path.

## Docker Compose（Linux containers, x86_64）

```bash
docker compose build
docker compose run --rm mediaclean .venv/bin/python scripts/download-model.py
docker compose up -d
docker compose logs -f
```

打开 / Open **http://127.0.0.1:3220**.

首次构建会联网安装依赖，模型单独下载并校验。之后处理无需远程推理服务。数据和模型保存在命名卷中，重建容器不清除它们。

Initial build downloads dependencies; weights are downloaded and verified separately. Processing then requires no remote inference service. Named volumes preserve data and weights across container rebuilds.

```bash
docker compose down
# Update source, then rebuild / 更新源码后重新构建：
git pull --ff-only
docker compose up -d --build
```

不要加 `down -v`，除非你确实要删除数据与模型。备份时先停止服务，再备份两个命名卷。

Do not use `down -v` unless you intend to delete data and weights. Stop the service before backing up both named volumes.

容器内监听 `0.0.0.0` 是为了端口映射；Compose 仅将端口发布到宿主机 `127.0.0.1`。不要改为公网映射。本地原生启动仍只监听回环地址。

The container listens on `0.0.0.0` for port forwarding; Compose publishes only to host loopback. Do not change this to a public binding. Native startup remains loopback-only.

## 验证范围 / Validation scope

Windows 基础测试与模型调用可在现有环境验证；Linux CI 验证基础 FFmpeg/HTTP 流程。Docker 构建与 Linux AI 推理需要对应运行环境单独验证，不能将 Windows 测试结果视为其通过证明。视频 AI 仍为实验功能。

Windows basic tests and model invocation can be checked locally; Linux CI covers basic FFmpeg/HTTP behavior. Docker builds and Linux AI inference require separate validation in those environments. Windows checks do not establish their success. Video AI remains experimental.
