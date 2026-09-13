# 第三方声明 / Third-party notices

MediaClean's MIT license applies to original project code, not third-party dependencies, model weights or user media. Dependencies are installed separately, not bundled here.

MediaClean 的 MIT 适用于自有代码，不覆盖第三方依赖、权重和用户素材；依赖由用户另行安装。

| Component / 组件 | Upstream / 上游 |
| --- | --- |
| LaMa research and code / 研究与代码 | https://github.com/advimman/lama |
| TorchScript weight source / 权重来源 | https://github.com/enesmsahin/simple-lama-inpainting |
| PyTorch | https://github.com/pytorch/pytorch |
| NumPy | https://github.com/numpy/numpy |
| Pillow | https://github.com/python-pillow/Pillow |
| psutil | https://github.com/giampaolo/psutil |
| OpenCV Python distribution | https://github.com/opencv/opencv-python |
| FFmpeg | https://ffmpeg.org/legal.html |
| Optional Playwright developer checks | https://github.com/microsoft/playwright |

The LaMa code repository provides an Apache-2.0 license. A code repository license alone is not a blanket assurance about all downloadable weights. Review the exact upstream artifact terms for redistribution or commercial packaging. See `models/README.md` for the source and checksum of the separately downloaded file.

LaMa 代码仓库提供 Apache-2.0 许可；代码许可不应被当作所有可下载权重的统一保证。重新分发或商业打包时核对具体上游文件的条款。单独下载的模型来源与校验值见 `models/README.md`。

FFmpeg licensing depends on build configuration. This repository invokes the installed executable and does not distribute an FFmpeg build. Promotional files and local media are intentionally excluded.

FFmpeg 条款取决于编译配置；本仓库调用用户安装的程序，不分发其二进制。宣传文件和本地素材不随源码发布。
