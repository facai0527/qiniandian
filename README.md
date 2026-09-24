# 祈年殿 · 所祈为年，所愿为丰

六章连续滚动、真实GLB模型、可逆结构展开与鎏金山水视频背景。此目录就是独立网站仓库；不要把上层的Blender工程、渲染图和本地检查记录一起上传。

## 上传 GitHub 并部署（自己操作）

1. 在 GitHub 创建一个仓库，或使用已有的 `qiniandian` 仓库。免费账户可用公开仓库部署 Pages。公开站点里的模型和视频也可被访问，请确认这些素材可以公开。
2. 把**本目录里面的内容**放在仓库根目录：应直接看到 `package.json`、`index.html`、`src/`、`public/`、`scripts/` 和 `.github/workflows/deploy.yml`。不要额外套一层 `site/`。不要上传 `node_modules/`、`dist/`、`.git/`、环境变量或原始 Blender 工程。
3. 推荐先把交付的 `qiniandian-github-upload.zip` 解压到一个新文件夹，再用 GitHub Desktop 建立/添加仓库，确认目标正确后自行提交并 Push。上传包已排除旧 `.git`、`node_modules` 和 `dist`。若使用网页上传，上传解压后的内容，注意一起上传 `.github` 工作流目录，不要把 ZIP 文件本身当作网站源码上传。
4. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
5. 在 **Actions → Deploy to GitHub Pages → Run workflow** 手动运行一次，分支选 `main`（或 `master`）。之后向这两个分支提交就会自动重新部署。
6. 等待工作流变成绿色，从 Pages 设置或成功任务的 `github-pages` 链接进入网站。若原本上传时尚未开启 Pages 导致首次失败，完成第4步后重新运行即可。

路径会自动匹配仓库名，不强制仓库叫 `qiniandian`。用户主页仓库或已配置的自定义域名也由 Pages 元数据确定路径。模型、视频和解码器都在仓库里，无需额外文件服务器、API密钥或付费后端。

> 本地准备与检查不等于线上部署成功。当前没有替你推送代码或发布；只有你自行上传/推送并运行工作流后，才会有线上地址。

### 如果继续使用现有本地 Git 仓库

原仓库历史中已跟踪 `node_modules/` 和 `dist/`，仅新增 `.gitignore` 不会自动停止跟踪。不要直接把全部历史生成文件一起提交；可在本目录先执行以下命令，再在 GitHub Desktop 审核改动、提交及推送：

```sh
git rm -r --cached --ignore-unmatch node_modules dist
```

这只取消 Git 跟踪，保留电脑上的实际文件。本次没有替你修改 Git 暂存区、提交、推送或清理历史；干净上传包不含旧仓库历史。

## 本地预览

安装 Node.js 22.12 或更新的22.x版本后，在此目录执行：

```sh
npm ci
npm run check:assets
npm run dev -- --host 127.0.0.1 --port 5177
```

预览地址：`http://127.0.0.1:5177/qiniandian/`。

生产构建检查：

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

然后打开 `http://127.0.0.1:4173/qiniandian/`，不要直接双击 `dist/index.html`，浏览器会限制本地模型和模块加载。

## 发布前后检查

- 电脑和手机都能看到模型，横竖屏视频正常播放；第一次加载模型约11.5–12.6MB，取决于网络。
- 六章节导航、自由观察、末尾展开、反向归位正常；网页能到达最后一屏。
- 手机允许触摸上下滑动，减少动态偏好会使用静态背景。
- 浏览器若禁止自动播放，可点背景播放入口；资源失败会显示重试。
- 现有视频首尾并非严格无缝，循环边界可能有跳变；低端硬件不保证60fps。

## 常见问题

- **构建红色**：打开 Actions 的失败步骤；`check:assets` 会明确指出哪个模型/视频/解码器漏传。
- **首页404**：确认 Pages 已选择 GitHub Actions，工作流成功，且文件没有套在 `site/` 子目录。
- **只有文字没有建筑**：保留 `public/models/` 和 `public/draco/gltf/` 的实际二进制文件及大小写；不要上传 Git LFS 指针代替资产。
- **更换仓库名**：再次运行工作流即可重新生成资源路径。

## 来源与边界

建筑为基于公开资料的解释性数字重建，非测绘级成果。现有六组模型、贴图、视频与原工程说明见 `SCROLL-PREVIEW.md`、`RENDERING-NOTES.md`、`COLOR-DIRECTION.md`。`history.html` 为保留的历史页面，不是当前首页。

部署配置依据：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Vite 静态部署](https://vite.dev/guide/static-deploy)。
