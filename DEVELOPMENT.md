# 开发指南

## 项目结构

```
dj-common/
├── src/                      # 源代码
│   ├── index.ts             # 主入口
│   ├── WebSocketClient.ts   # WebSocket 客户端
│   ├── MessageSocket.ts     # WebSocket 消息管理
│   ├── logger.ts            # 日志系统
│   └── ...                  # 其他模块
├── dist/                     # 构建输出（自动生成）
├── .github/                  # GitHub Actions 配置
│   └── workflows/
│       ├── ci.yml           # CI 流程
│       └── release.yml      # 发布流程
├── .husky/                   # Git hooks
├── eslint.config.js         # ESLint 配置 (Flat Config)
├── .prettierrc              # Prettier 配置
├── .gitattributes           # Git 属性配置
├── commitlint.config.cjs    # Commit 规范配置
├── .versionrc.json          # 版本管理配置
└── rollup.config.js         # 构建配置

```

## 开发流程

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式

```bash
npm run dev
```

监听文件变化，自动重新构建。

### 3. 添加新模块

只需在 `src/` 目录下创建新的 `.ts` 文件，构建系统会自动检测并构建。

例如，创建 `src/NewModule.ts`：

```typescript
class NewModule {
  // 你的代码
}

export default NewModule
```

构建后会自动生成：

- `dist/NewModule.esm.js`
- `dist/NewModule.cjs.js`
- `dist/NewModule.d.ts`

并且可以通过以下方式引入：

```typescript
import NewModule from '@brewer/dj-common/NewModule'
```

**注意事项：**

- 所有模块应使用 TypeScript 编写（.ts 扩展名）
- 使用 ESM 的 export/import 语法
- 为公共 API 提供完整的类型定义
- 在 `src/index.ts` 中导出新模块，以支持从主入口引入

### 4. 代码规范

#### 自动格式化

```bash
npm run format
```

#### 代码检查

```bash
npm run lint
```

### 5. 提交代码

项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

**提交格式：**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type):**

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `build`: 构建
- `ci`: CI 配置
- `chore`: 其他

**示例：**

```bash
git commit -m "feat: 添加新的 WebSocket 模块"
git commit -m "fix: 修复连接断开后无法重连的问题"
git commit -m "docs: 更新 README"
```

**Git Hooks:**

- `pre-commit`: 自动运行 lint-staged（代码检查和格式化）
- `commit-msg`: 检查提交信息格式

### 6. 构建

```bash
npm run build
```

构建过程会：

1. 清理 `dist` 目录
2. 自动扫描 `src` 目录下的所有模块
3. 为每个模块生成 ESM 和 CommonJS 两种格式
4. 生成 source map

### 7. 版本发布

项目支持三种发布方式：

#### 方式一：使用 Claude Code 自动发布（最简单）

使用 Claude Code 可以帮助你自动完成整个发布流程：

1. **确保已登录 npm**（仅首次需要）：

   ```bash
   npm login
   ```

2. **让 Claude 执行发布流程**：
   只需告诉 Claude："请帮我发布一个新版本"，Claude 会自动：
   - 检查代码状态
   - 运行构建和检查
   - 根据 commit 历史决定版本号
   - 生成 CHANGELOG
   - 创建 git tag
   - 推送到远程仓库
   - 发布到 npm

3. **或者手动运行完整流程**：
   ```bash
   npm run release:all
   ```

#### 方式二：使用 GitHub Actions 自动发布（推荐生产环境）

配置一次，之后每次发布只需要：

```bash
# 1. 更新版本和 CHANGELOG（会自动提交）
npm run release

# 2. 推送 tag 到 GitHub（会自动触发发布）
git push --follow-tags origin main
```

GitHub Actions 会自动：

- 运行 CI 检查
- 构建项目
- 发布到 npm
- 创建 GitHub Release

**首次使用需要配置：**

1. **创建 NPM Granular Access Token**：

   由于 NPM 现在使用 Granular Access Tokens，建议通过网页创建：

   a. 访问 NPM Token 管理页面：

   ```
   https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   ```

   b. 点击 "Generate New Token" → "Granular Access Token"

   c. 配置 Token：
   - **Token Name**: `dj-common-github-actions`
   - **Expiration**: 90 days（最长有效期）
   - **Packages and scopes**: 选择 "Select packages and scopes"
   - 搜索并添加你的包（如 `@brewer/dj-common`）
   - **Permissions**: 选择 "Read and write"

   d. 点击 "Generate Token" 并**立即复制** token（只显示一次）

2. **在 GitHub 仓库中设置 Secret**：
   - 进入仓库 Settings → Secrets and variables → Actions
   - 点击 "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: 粘贴上一步获取的 token
   - 点击 "Add secret"

3. **完成！** 之后每次推送 tag 都会自动发布

#### 方式三：手动发布

**Patch 版本 (1.0.0 -> 1.0.1)**

```bash
npm run release:patch
```

**Minor 版本 (1.0.0 -> 1.1.0)**

```bash
npm run release:minor
```

**Major 版本 (1.0.0 -> 2.0.0)**

```bash
npm run release:major
```

**自动决定版本（根据 commit 类型）**

```bash
npm run release
```

**测试发布流程（不会实际修改文件）**

```bash
npm run release:dry-run
```

然后推送并发布：

```bash
npm run release:publish
```

或者分步执行：

```bash
git push --follow-tags origin main
npm publish
```

#### NPM 脚本说明

| 脚本命令                  | 说明                               |
| ------------------------- | ---------------------------------- |
| `npm run build`           | 构建项目                           |
| `npm run lint`            | 代码检查                           |
| `npm run lint:fix`        | 自动修复代码问题                   |
| `npm run format`          | 格式化代码                         |
| `npm run release`         | 自动决定版本号并生成 CHANGELOG     |
| `npm run release:patch`   | 发布 patch 版本 (x.x.1)            |
| `npm run release:minor`   | 发布 minor 版本 (x.1.0)            |
| `npm run release:major`   | 发布 major 版本 (1.0.0)            |
| `npm run release:dry-run` | 模拟发布流程（不修改文件）         |
| `npm run release:publish` | 推送 tag 并发布到 npm              |
| `npm run release:all`     | 一键完成构建、版本更新、推送和发布 |

#### 使用 Claude Code 的好处

1. **智能决策**：Claude 可以分析你的 commit 历史，建议合适的版本号
2. **错误处理**：遇到问题时自动处理或提供解决方案
3. **一次性完成**：只需一个命令即可完成所有步骤
4. **交互式确认**：在关键步骤（如发布前）会征求你的确认
5. **自动修复**：发现代码问题时自动修复

#### CI/CD 流程

项目配置了两个 GitHub Actions workflow：

**1. CI Workflow** (`.github/workflows/ci.yml`)

- 触发时机：每次 push 到 main 分支或创建 PR
- 执行内容：
  - 在 Node.js 18.x, 20.x, 22.x 上运行测试
  - 执行 ESLint 检查
  - 构建项目
  - 上传构建产物

**2. Release Workflow** (`.github/workflows/release.yml`)

- 触发时机：推送 v 开头的 tag（如 v1.0.0）
- 执行内容：
  - 运行 ESLint 检查
  - 构建项目
  - 发布到 NPM
  - 创建 GitHub Release

## 版本管理

使用 [standard-version](https://github.com/conventional-changelog/standard-version) 自动管理版本：

- 根据 commit 信息自动升级版本号
- 自动生成 CHANGELOG.md
- 自动创建 git tag

## 发布检查清单

- [ ] 所有测试通过
- [ ] 代码已经过 lint 检查
- [ ] 已更新相关文档
- [ ] 已提交所有更改
- [ ] 版本号正确
- [ ] CHANGELOG 正确生成

## 常见问题

### Q: 如何跳过 Git Hooks？

```bash
git commit --no-verify -m "message"
```

**注意：** 不推荐跳过 hooks，除非你明确知道自己在做什么。

### Q: 如何修改 commit 规范？

编辑 `commitlint.config.cjs` 文件。

### Q: 如何自定义 CHANGELOG 格式？

编辑 `.versionrc.json` 文件。

### Q: 构建失败怎么办？

1. 删除 `node_modules` 和 `package-lock.json`
2. 重新安装依赖：`npm install`
3. 清理缓存：`npm cache clean --force`

## 最佳实践

1. **小步提交**：每个 commit 只做一件事
2. **有意义的提交信息**：让别人（和未来的你）能够理解
3. **及时更新文档**：代码和文档同步更新
4. **保持代码整洁**：运行 lint 和 format
5. **测试先行**：添加功能前先写测试
6. **及时发布**：积累足够的更改后及时发布新版本

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 技术栈

- **构建工具**: Rollup
- **转译器**: Babel
- **代码检查**: ESLint
- **代码格式化**: Prettier
- **Git Hooks**: Husky + lint-staged
- **版本管理**: standard-version
- **提交规范**: Conventional Commits
