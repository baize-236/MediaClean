# 安全说明 / Security

本项目是单用户本地工具，不提供公网托管所需的认证或租户隔离。请不要直接暴露本地端口。模型文件应从文档指定上游获取并校验，避免加载未知权重。

This is a single-user local application, without authentication or tenant isolation for public hosting. Do not expose its port. Obtain model weights from the documented upstream and verify their checksum.

报告漏洞时不要在公开 Issue 中附带密钥、个人素材或可直接利用的敏感细节。若仓库提供 GitHub 私密漏洞报告入口，请使用该入口；否则先提交不含利用细节的联系请求。项目尚未承诺安全响应时限。

Do not include secrets, personal media or sensitive exploit details in public issues. Use GitHub private vulnerability reporting if enabled; otherwise request a private reporting channel without exploit details. No response-time guarantee is provided.
