# 开发指南 / Development

## 目录 / Structure

```text
public/       Browser UI / 浏览器界面
src/          FFmpeg and Python adapters / 媒体处理适配
server.js     Local HTTP server and queue / 本地服务与队列
scripts/      AI workers and manual checks / AI 子进程及专项检查
test/         Automated Node.js tests / 自动化测试
models/       Model documentation; weights ignored / 模型文档
data/         Local runtime data, never committed / 运行数据不提交
docs/         Bilingual documentation / 双语文档
```

Node.js uses built-in modules; there are no production npm dependencies. Python AI dependencies are pinned in the two requirements files. Source files use UTF-8; `.editorconfig` and `.gitattributes` define whitespace and line endings. Existing compact source layout is retained to avoid unrelated behavior changes.

Node.js 使用内置模块，没有生产 npm 依赖。Python AI 依赖固定在两个 requirements 文件中。源码采用 UTF-8，编辑与换行规则由配置文件约定；保留现有紧凑代码布局，避免无关改动。

## 自动化测试 / Automated tests

```powershell
npm ci
npm test
```

FFmpeg and FFprobe must be on PATH. Tests generate synthetic media, use temporary directories and an isolated HTTP port, and do not require LaMa. A passing basic suite does not establish AI quality.

需要 FFmpeg/FFprobe。测试生成合成素材，使用临时目录与独立端口，不需要 LaMa；基础测试通过不代表 AI 效果已验证。

## 专项检查 / Manual checks

Browser checks are optional developer tools, not part of `npm test`. Install Playwright locally without changing the dependency manifest; these scripts currently use installed Microsoft Edge. Start the app on port 3220 first, except `check-video.cjs`, which starts its own server on 3231. They may create local tasks: use a disposable development data directory.

浏览器检查为可选开发工具，当前使用本机 Microsoft Edge。除自行启动 3231 服务的 `check-video.cjs` 外，需要先启动 3220 服务。检查可能创建任务，请使用独立开发数据目录。

```powershell
npm install --no-save --package-lock=false playwright
$env:MEDIA_CLEAN_DATA_DIR = "$PWD/data/dev-checks"
npm start
# In a second terminal / 第二个终端：
node scripts/check-preview.cjs
node scripts/check-editor.cjs
.venv\Scripts\python.exe scripts/verify-editor.py
.venv\Scripts\python.exe scripts/make-video-fixture.py
node scripts/check-video.cjs
.venv\Scripts\python.exe scripts/verify-video-quality.py
```

Editor and video AI checks require installed Python dependencies and weights. `check-blur.cjs` expects the editor fixture. `check-mode-ui.cjs` expects the video fixture. Benchmark scripts require a completed local image task; `check-lama-ui.cjs` additionally assumes the historical benchmark image dimensions. These historical checks are not all portable acceptance tests; inspect prerequisites and selectors before use.

编辑器和视频 AI 检查需要模型环境。模糊检查依赖编辑器样片，模式检查依赖视频样片。基准脚本需要本地已有完成的图片任务；`check-lama-ui.cjs` 还假设旧基准图片尺寸。这些历史脚本并非全部可直接复用的验收测试，运行前需检查前置条件与界面选择器。

## 配置 / Configuration

`PORT` defaults to 3220; `MEDIA_CLEAN_DATA_DIR` defaults to project `data/`. The server accepts `127.0.0.1` host headers only. AI workers select the platform's virtual environment path; `PYTHON_PATH` can override it. `HOST=0.0.0.0` is intended only for containers with loopback port publishing. `.env` files are not automatically loaded by Node. See [local deployment](LOCAL_DEPLOYMENT.md).

`PORT` 默认 3220，`MEDIA_CLEAN_DATA_DIR` 默认项目 `data/`。服务仅接受本机 Host。AI 按系统选择虚拟环境路径，可用 `PYTHON_PATH` 覆盖。`HOST=0.0.0.0` 仅用于绑定宿主回环端口的容器。Node 不自动加载 `.env`。见 [本地部署](LOCAL_DEPLOYMENT.md)。
