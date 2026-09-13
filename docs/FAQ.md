# 常见问题 / FAQ

**为什么 AI 失败？ / Why does AI fail?**

检查 Python 3.11 环境、两个 requirements 文件和 `models/big-lama.pt`。模型下载器可以复核校验值。大选区可缩小后重试。

Check Python 3.11, both requirements files and the model. Rerun the downloader to verify the checksum. Try smaller regions for resource-related failures.

**图片显示不完整？ / Image does not fit?**

先恢复浏览器 100% 缩放，刷新后重新添加素材。反馈时附浏览器版本、窗口尺寸与合成样片。

Reset browser zoom to 100%, refresh and re-add media. Include browser version, viewport size and a synthetic example when reporting.

**视频能完全无痕吗？ / Is video repair seamless?**

不能保证。先检查轨迹和前 3 秒结果，复杂运动、透明或变形水印可能跟丢，也可能有闪烁。

No guarantee. Inspect tracking and the first three seconds. Motion, transparency and deformation can cause tracking failures or flicker.

**如何换端口？ / Change the port?**

```powershell
$env:PORT = '3221'
npm start
```

访问 / Visit `http://127.0.0.1:3221`。双击启动脚本仍打开默认端口 / The double-click launcher still opens the default port.

**是否支持在线部署或英文界面？ / Hosted service or English UI?**

目前都没有。文档为双语，产品界面仍为中文。

Neither is currently provided. Documentation is bilingual; the UI remains Chinese.
