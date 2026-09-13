# 发布检查 / Release checklist

- 运行 `npm ci`、`npm test`；模型校验另行执行 / Run install/tests and verify optional model separately.
- 确认 README 两种语言一致 / Keep both README languages aligned.
- 检查 `git diff --cached` 与 `git ls-files`，不得包含个人数据、模型、环境、宣传素材或密钥 / Review staged content; exclude private data, weights, environments, promotional media and secrets.
- 依赖和模型遵循各自许可，不能把项目 MIT 当成权重许可 / Dependency and model terms are separate from the project MIT license.
- 提交源码后推送；不要直接压缩整个工作目录 / Commit and push reviewed sources; never ZIP the entire working directory.
- 可从提交生成干净源码包 / Generate a clean source archive from the commit:

```powershell
git archive --format=zip --output=../MediaClean-source.zip HEAD
```

源码包不含 FFmpeg、Python 环境和模型，不是可双击安装的程序。发布说明应明确这个区别。

The source archive excludes FFmpeg, the Python environment and weights. It is not a standalone installer; say so in release notes.
