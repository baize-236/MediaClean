# MediaClean

简体中文 · [English](README.en.md)

在自己的电脑上清理图片中的干扰区域，批量处理素材，并探索短视频移动水印修复。

**本地运行 · LaMa 图片修复 · 前后对比 · 实验性视频跟踪**

> 当前面向 Windows，界面为简体中文。这是本地浏览器应用，不是在线服务或独立安装器。视频 AI 修复仍为实验功能。

## 功能

| 功能 | 图片 | 视频 |
| --- | --- | --- |
| LaMa AI 修复 | 多矩形、画笔、橡皮擦、撤销 | 实验性逐帧修复 |
| 快速填补、可调区域模糊 | 支持 | 支持 |
| 移动水印轨迹分析 | 不适用 | 手动选择模板后跟踪 |
| 批量任务、下载、前后对比 | 支持 | 支持 |

输入支持 JPG、PNG、WebP、BMP，以及 MP4、MOV、MKV、AVI、WebM、M4V；实际解码取决于 FFmpeg。单文件上传上限 2 GB。图片导出 PNG，视频导出 MP4。

## 快速开始

下载并解压本仓库，或使用当前 GitHub 仓库地址克隆，在项目根目录打开 PowerShell。

安装 Node.js 22 或更新版本，以及包含 `ffmpeg` 和 `ffprobe` 的 FFmpeg，并将它们加入 PATH：

```powershell
node --version
ffmpeg -version
ffprobe -version
npm ci
npm start
```

打开 **http://127.0.0.1:3220**，也可双击 `启动.cmd`。在终端按 Ctrl+C 停止服务。

基础填补和模糊不需要 Python 或模型。尚未安装 AI 环境时，请切换到快速填补或区域模糊。

## 启用本地 AI

安装 Python 3.11，然后运行；不需要激活虚拟环境：

```powershell
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-torch.txt
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe scripts/download-model.py
npm start
```

首次安装需要联网下载依赖和约 206 MB 模型，之后素材推理在本机进行。下载器校验 SHA-256，不会覆盖校验不匹配的已有模型。下载受限时参考 [模型说明](models/README.md) 手动放置，再运行下载器校验。

使用 PyTorch CPU 推理，不要求 NVIDIA 显卡。速度和内存占用取决于机器与选区，没有承诺最低内存或 GPU 加速。目前仅验证 Windows 环境。

## 使用方法

1. 选择、拖入或粘贴浏览器支持的图片/视频文件。
2. 选择适用于当前素材的处理方式，标记干扰区域。
3. 图片 AI 模式可用矩形、画笔、橡皮擦、缩放和撤销。
4. 提交任务，查看前后对比并下载；批量操作前检查各素材选区。

视频 AI：暂停到水印清晰的帧并框选 → 分析轨迹 → 检查定位 → 确认 → 先处理前 3 秒或完整短视频。低可信度帧跳过修复。

## 限制与隐私

- LaMa 推测缺失内容，不能保证恢复原始细节；模糊只覆盖区域，不重建背景。
- 视频 AI 使用模板匹配、LaMa 和有条件的光流混合，不是 ProPainter，也不是无需选框的通用检测模型。
- 视频 AI 限制：不超过 30 秒，固定帧率 1–60 fps；输出长边不超过 1920、短边不超过 1080，并适配偶数尺寸。缩放、旋转、透明水印和复杂背景可能误判或闪烁。
- 原素材、结果和历史保存在 `data/`。删除任务会清理关联文件。刷新会丢失未提交的编辑；关闭页面不停止服务端任务，停止服务进程会中断处理。
- 仅监听本机地址，没有登录或用户隔离，不要将服务直接转发到公网。
- 请处理自有或已获授权的素材。

## 开发与文档

```powershell
npm test
```

测试用 FFmpeg 生成合成素材，验证基础处理及 HTTP 上传下载，不需要模型。AI 与浏览器验证另见开发指南。

- [开发与测试 / Development](docs/DEVELOPMENT.md)
- [常见问题 / FAQ](docs/FAQ.md)
- [贡献指南 / Contributing](CONTRIBUTING.md)
- [发布步骤 / Release checklist](docs/RELEASING.md)
- [更新记录 / Changelog](CHANGELOG.md)
- [第三方声明 / Third-party notices](THIRD_PARTY_NOTICES.md)

## 许可证

自有代码采用 [MIT License](LICENSE)。第三方依赖与模型权重遵循各自条款，不由本项目重新授权。模型、个人素材和宣传视频不包含在源码发布中。
