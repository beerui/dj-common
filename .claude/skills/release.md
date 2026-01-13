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

2. **文档检查和生成**
   - 检查是否存在 `docs/` 文件夹
   - 扫描 `src/` 目录下的所有模块文件（.ts, .js）
   - 对每个公共模块，检查 `docs/` 目录是否有对应的 API 文档
   - 如果缺少文档，自动生成包含以下内容的 Markdown 文档：
     - 模块概述
     - 导出的类/函数/接口列表
     - 主要方法的参数和返回值说明
     - 使用示例
     - 相关类型定义
   - 生成的文档应包含从源码中提取的 JSDoc/TSDoc 注释
   - 将生成的文档保存到 `docs/api/` 目录

3. **代码检查和构建**
   - 运行 ESLint 检查
   - 运行构建命令

4. **版本决策**
   - 分析最近的 commit 历史
   - 建议合适的版本类型（patch/minor/major/beta）
   - 显示即将发布的 CHANGELOG 预览

5. **用户确认**
   - 展示版本信息
   - 显示新生成的文档（如果有）
   - 询问用户确认或选择其他版本类型

6. **执行发布**
   - 如果有新生成的文档，先提交文档更改
   - 更新版本号
   - 生成 CHANGELOG
   - 创建 git tag
   - 推送到远程仓库（包括文档）
   - 触发 GitHub Actions 自动发布到 npm

7. **完成提示**
   - 显示发布结果
   - 提供 npm 包链接
   - 提供 GitHub Release 链接
   - 列出新生成或更新的文档

## 文档生成规则

### 自动检测需要文档的模块

- 扫描 `src/` 目录下所有导出的模块
- 忽略以 `_` 开头的私有文件
- 忽略测试文件（`*.test.ts`, `*.spec.ts`）
- 忽略类型定义文件（`*.d.ts`）

### 文档结构

生成的文档应包含：

````markdown
# ModuleName

> 模块简介（从源文件顶部注释提取）

## 安装

```bash
npm install @brewer/dj-common
```

## 导入

```typescript
import { ModuleName } from '@brewer/dj-common'
// 或
import ModuleName from '@brewer/dj-common/ModuleName'
```

## API

### ClassName/FunctionName

**描述**：功能描述

**类型签名**：

```typescript
function functionName(param1: Type1, param2: Type2): ReturnType
```

**参数**：

| 参数名 | 类型  | 必填 | 默认值 | 说明     |
| ------ | ----- | ---- | ------ | -------- |
| param1 | Type1 | 是   | -      | 参数说明 |
| param2 | Type2 | 否   | null   | 参数说明 |

**返回值**：

返回值类型和说明

**示例**：

```typescript
// 使用示例代码
const result = functionName(arg1, arg2)
```

## 类型定义

```typescript
// 相关的 interface/type 定义
interface ConfigType {
  option1: string
  option2: number
}
```

## 相关链接

- [GitHub 仓库](https://github.com/beerui/dj-common)
- [NPM 包](https://www.npmjs.com/package/@brewer/dj-common)
````

### 文档位置

- 主文档：`docs/README.md`
- API 文档：`docs/api/ModuleName.md`
- 指南文档：`docs/guides/`
- 更新日志：自动从 `CHANGELOG.md` 链接

## 错误处理

Skill 会自动处理常见错误：

- npm 未登录：提示登录
- 构建失败：显示错误并停止
- 推送失败：提供解决建议
- 发布失败：诊断问题并给出建议
