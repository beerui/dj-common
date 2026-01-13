---
name: beta
description: 快速发布 beta 版本(尾部版本号+1)
---

# Beta 快速发布

快速发布新的 beta 版本，版本号尾部数字自动加 1。

## 执行流程

1. **读取当前版本号**
   - 从 package.json 读取当前版本
   - 自动计算新版本号(尾部+1)

2. **更新版本号**
   - 更新 package.json 中的 version 字段

3. **构建项目**
   - 运行 `npm run build` 构建产物

4. **提交更改**
   - git add package.json
   - git commit -m "chore: bump version to x.x.x-beta.x"

5. **创建并推送 tag**
   - 创建 git tag vx.x.x-beta.x
   - 推送代码到 main 分支
   - 推送 tag 到远端

## 自动发布

**无需手动执行 npm publish！**

推送 tag 后，GitHub Actions 会自动：

- 检测到新的 tag
- 运行构建流程
- 发布到 npm registry

## 使用示例

只需说：

- "beta" 或 "/beta"
- "发布 beta 版本"

系统会自动完成所有操作，从版本号更新到推送 tag。

## 注意事项

- 确保 git 工作区是干净的（已提交的更改除外）
- 确保有推送到远程仓库的权限
- GitHub Actions 需要配置 NPM_TOKEN
