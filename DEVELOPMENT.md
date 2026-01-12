# 开发指南

## 项目结构

```
dj-common/
├── src/                      # 源代码
│   ├── index.js             # 主入口
│   ├── MessageSocket.js     # WebSocket 消息管理
│   ├── *.d.ts               # TypeScript 类型声明
│   └── ...                  # 其他模块（自动扫描）
├── dist/                     # 构建输出（自动生成）
├── scripts/                  # 脚本文件
│   └── release.sh           # 发布脚本
├── .husky/                   # Git hooks
├── .eslintrc.cjs            # ESLint 配置
├── .prettierrc              # Prettier 配置
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

只需在 `src/` 目录下创建新的 `.js` 文件，构建系统会自动检测并构建。

例如，创建 `src/NewModule.js`：

```javascript
class NewModule {
  // 你的代码
}

export default NewModule
```

构建后会自动生成：
- `dist/NewModule.esm.js`
- `dist/NewModule.cjs.js`

并且可以通过以下方式引入：
```javascript
import NewModule from '@beerui/dj-common/NewModule'
```

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

#### 方式一：使用发布脚本（推荐）

```bash
bash scripts/release.sh
```

脚本会引导你完成：
1. 检查 git 状态
2. 运行代码检查
3. 选择版本类型
4. 自动生成 CHANGELOG
5. 创建 git tag
6. 推送到远程仓库
7. 发布到 npm

#### 方式二：手动发布

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

**自定义版本**
```bash
npm run release -- --release-as 2.0.0
```

然后推送并发布：
```bash
git push --follow-tags origin main
npm publish
```

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
