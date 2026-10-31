# 2step 双耳渲染盲听测试

静态网站，包含两种测试：

- 身份辨认：比较双耳渲染版和 Bypassed 版。
- 听感偏好：比较双声道输入和多声道输入的双耳渲染版，并提供“不确定哪个好”选项。

两种测试均可分别调节 A、B 的播放音量。网页按片段匹配电平，并控制站内解码音频的样本峰值。默认音频在 `public/audio/`；访客也能在浏览器本地载入自己的两份音频。

## 本地预览

在仓库根目录运行：

```powershell
python -m http.server 8765 --directory public
```

然后打开 `http://127.0.0.1:8765/`。需要通过 HTTP 预览，直接双击 HTML 文件可能无法正常载入默认音频。

## 发布

推送到 `main` 后，GitHub Actions 会将 `public/` 发布到 GitHub Pages。发布记录在 `.github/workflows/deploy.yml` 对应的 Actions 页面。

默认音频由项目维护者提供。复用或再分发这些音频前请先取得相应许可。
