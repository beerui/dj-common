---
name: release
description: 自动化发布新版本到 npm
triggers:
  - '发布新版本'
  - '发布版本'
  - 'release'
  - '发布'
  - 'publish'
  - 'npm publish'
---

# Release Skill

自动化发布新版本到 npm。

## 使用方法

只需告诉 Claude：

- "发布新版本"
- "帮我 release"
- "发布到 npm"

## 执行流程

1. **前置检查**
   - 检查 git 状态（是否有未提交的更改）
   - 检查当前分支（是否在 main 分支）
   - 检查 npm 登录状态

2. **代码检查和构建**
   - 运行 ESLint 检查
   - 运行构建命令

3. **版本决策**
   - 分析最近的 commit 历史
   - 建议合适的版本类型（patch/minor/major）
   - 显示即将发布的 CHANGELOG 预览

4. **用户确认**
   - 展示版本信息
   - 询问用户确认或选择其他版本类型

5. **执行发布**
   - 更新版本号
   - 生成 CHANGELOG
   - 创建 git tag
   - 推送到远程仓库
   - 发布到 npm

6. **完成提示**
   - 显示发布结果
   - 提供 npm 包链接
   - 提供 GitHub Release 链接

## 错误处理

Skill 会自动处理常见错误：

- npm 未登录：提示登录
- 构建失败：显示错误并停止
- 推送失败：提供解决建议
- 发布失败：诊断问题并给出建议
