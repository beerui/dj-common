---
name: release
description: 快速发布新版本到 npm
triggers:
  - '发布新版本'
  - '发布版本'
  - 'release'
  - '发布'
  - 'publish'
  - 'npm publish'
  - '发布 beta'
  - 'release beta'
---

# Release Skill - 快速发布流程

快速自动化发布新版本到 npm，优化了发布速度。

## 使用方法

### 快速发布（推荐）

- "发布新版本" - 自动决定版本号并发布
- "发布 patch 版本" - 发布补丁版本 (x.x.1)
- "发布 minor 版本" - 发布次版本 (x.1.0)
- "发布 major 版本" - 发布主版本 (1.0.0)
- "发布 beta 版本 x.x.x" - 发布指定的 beta 版本

### 带文档生成的发布

- "发布新版本并生成文档" - 发布前检查和生成缺失的 API 文档

## 执行流程（已优化）

### 快速模式（默认）

1. **智能检查**（并行执行）
   - 检查 git 状态（未提交的更改会自动包含）
   - 分析最近的 commit 决定版本号
   - 预览 CHANGELOG 内容

2. **自动执行**
   - 更新 package.json 版本号
   - 更新 CHANGELOG.md
   - 提交更改
   - 运行命令 `git push` 推送到远程

3. **完成通知**
   - 显示新版本号
   - 提供 GitHub Release 链接（会自动创建）
   - 清除生成的 tmpclaude 临时文件

**耗时**：约 10-15 秒

## 版本决策逻辑

自动分析最近的 commits：

- 包含 `BREAKING CHANGE` 或 `!`：major 版本
- 包含 `feat:`：minor 版本
- 包含 `fix:`：patch 版本
- 包含 `beta` 关键字：beta 版本
- 默认：patch 版本

## 错误处理

快速失败，清晰提示：

- Git 冲突：显示冲突文件，建议解决方案
- 推送失败：检查网络和权限

## 性能优化

- ✅ 并行执行独立检查
- ✅ 跳过由 CI/CD 处理的步骤
- ✅ 默认不生成文档（按需生成）
- ✅ 减少用户交互
- ✅ 利用 GitHub Actions 处理构建和发布
