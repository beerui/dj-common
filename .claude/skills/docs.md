---
name: docs
description: 生成文档
triggers:
  - '文档生成'
---

# Docs Skill - 生成文档

## 文档生成规则

### 自动检测需要文档的模块

- 扫描 `src/` 目录（排除 `index.ts`、`*.test.ts`、`*.d.ts`）
- 检查 `docs/api/` 是否有对应的 `.md` 文件
- 仅为缺失的文档生成基础模板

### 文档模板

```markdown
# ModuleName API

## 导入

\`\`\`typescript
import { ModuleName } from '@brewer/dj-common/ModuleName'
\`\`\`

## 接口定义

// 从源码提取的主要接口

## 使用示例

// 基本使用示例

## 配置选项

// 配置参数说明
```

### 文档位置

- API 文档：`docs/api/ModuleName.md`
- 主文档在 `README.md`（不自动生成）

## 性能优化

- ✅ 并行执行独立检查
- ✅ 减少用户交互
