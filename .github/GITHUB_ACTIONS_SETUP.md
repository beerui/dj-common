# GitHub Actions 自动发布配置指南

## 快速配置步骤

### 1. 创建 NPM Token

NPM 现在使用 **Granular Access Tokens**，需要通过网页创建。

#### 步骤：

1. **打开浏览器，访问**：

   ```
   https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   ```

   将 `YOUR_USERNAME` 替换为你的 npm 用户名

2. **创建新 Token**：
   - 点击右上角 **"Generate New Token"**
   - 选择 **"Granular Access Token"**（不要选 Classic Token）

3. **配置 Token**：

   | 字段                | 值                                |
   | ------------------- | --------------------------------- |
   | Token Name          | `dj-common-github-actions`        |
   | Expiration          | `90 days` (最长有效期)            |
   | Packages and scopes | 点击 "Select packages and scopes" |
   | 选择包              | 搜索并添加 `@brewer/dj-common`    |
   | Permissions         | 选择 **"Read and write"**         |

4. **生成并复制 Token**：
   - 点击底部的 **"Generate Token"**
   - **立即复制** token（这是唯一一次显示，之后无法再查看）
   - 保存到安全的地方（建议使用密码管理器）

### 2. 添加到 GitHub Secrets

1. **打开 GitHub 仓库**：

   ```
   https://github.com/YOUR_ORG/dj-common
   ```

2. **进入 Settings**：
   - 点击仓库顶部的 **"Settings"** 标签
   - 在左侧菜单找到 **"Secrets and variables"**
   - 点击 **"Actions"**

3. **创建新 Secret**：
   - 点击 **"New repository secret"** 按钮
   - **Name**: 输入 `NPM_TOKEN`（必须完全一致）
   - **Value**: 粘贴刚才复制的 NPM token
   - 点击 **"Add secret"**

### 3. 验证配置

配置完成后，你可以通过以下方式验证：

1. **查看 GitHub Secrets**：
   - 在 Settings → Secrets and variables → Actions
   - 应该能看到 `NPM_TOKEN` 已添加

2. **查看 Workflow 文件**：
   - 确认 `.github/workflows/release.yml` 文件存在
   - 确认文件中有 `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`

## 使用方法

配置完成后，每次发布新版本只需要：

```bash
# 1. 更新版本号并生成 CHANGELOG
npm run release

# 2. 推送 tag 到 GitHub（会自动触发发布）
git push --follow-tags origin main
```

GitHub Actions 会自动：

- ✅ 运行代码检查
- ✅ 构建项目
- ✅ 发布到 npm
- ✅ 创建 GitHub Release

## 常见问题

### Q: Token 过期了怎么办？

A: Granular Access Tokens 最长有效期是 90 天。过期后需要：

1. 重新创建一个新的 token
2. 在 GitHub Secrets 中更新 `NPM_TOKEN` 的值

### Q: 如何查看 Actions 运行状态？

A: 在 GitHub 仓库中：

- 点击 **"Actions"** 标签
- 查看 workflow 运行历史和日志

### Q: 发布失败了怎么办？

A: 检查以下几点：

1. NPM token 是否有效
2. Token 权限是否包含你的包
3. 包名和版本号是否正确
4. 查看 Actions 日志获取详细错误信息

### Q: 能否使用 CLI 创建 token？

A: NPM CLI 的 `npm token create` 命令不支持创建 Granular Access Tokens，建议使用网页界面。

## Token 安全建议

- ✅ 使用 Granular Access Tokens（更安全）
- ✅ 设置最短的必要有效期
- ✅ 只授予必要的包和权限
- ✅ 定期轮换 token
- ❌ 不要将 token 提交到代码仓库
- ❌ 不要在公开的地方分享 token

## 参考链接

- [NPM Granular Access Tokens 文档](https://docs.npmjs.com/about-access-tokens#granular-access-tokens)
- [GitHub Actions Secrets 文档](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [本项目的 Release Workflow](.github/workflows/release.yml)
