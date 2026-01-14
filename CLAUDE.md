# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

@brewer/dj-common 是一个多端通用的公共方法库，主要提供 WebSocket 相关的封装功能。使用 TypeScript 编写，提供完整的类型定义，同时支持 ESM 和 CommonJS 两种格式。

## Key Commands

### Development

```bash
npm run dev          # 开发模式（监听文件变化，自动重新构建）
npm run build        # 构建项目（生成 ESM 和 CJS 两种格式）
```

### Code Quality

```bash
npm run lint         # ESLint 检查
npm run lint:fix     # 自动修复代码问题
npm run format       # Prettier 格式化代码
```

### Release and Publish

```bash
npm run release:patch    # 发布 patch 版本 (x.x.1)
npm run release:minor    # 发布 minor 版本 (x.1.0)
npm run release:major    # 发布 major 版本 (1.0.0)
npm run release          # 自动决定版本号（根据 commit 类型）
npm run release:publish  # 推送 tag 并发布到 npm
npm run release:all      # 一键完成构建、版本更新、推送和发布
```

## Architecture

### Class Hierarchy

```
WebSocketClient (基础类)
    ├── 连接管理（connect/disconnect）
    ├── 心跳检测（自动发送 PING）
    ├── 自动重连（指数退避策略）
    ├── 消息回调系统（type-based routing）
    ├── 日志系统（可配置的日志级别）
    └── 生命周期钩子（onOpen/onClose/onError/onMessage）
         ↑
         │ 继承
         │
MessageSocket (业务类 - 静态单例)
    ├── 用户认证（userId + token）
    ├── URL 构建（baseUrl + path + 认证参数）
    ├── 全局消息管理
    └── 页面可见性管理（可选，用于多标签页场景）

Logger (日志类)
    ├── 多级别日志（debug/info/warn/error/silent）
    ├── 优先级控制（仅输出大于等于设定级别的日志）
    └── 带名称前缀的日志输出
```

**关键设计原则：**

- `WebSocketClient` 是通用的、可复用的基础封装，不包含任何业务逻辑
- `MessageSocket` 是针对特定业务场景（用户消息通知）的静态封装类
- `Logger` 提供统一的日志管理系统，支持灵活的日志级别控制
- 分层清晰，易于扩展新的业务场景类

### Message Flow

1. WebSocket 接收原始消息
2. `handleIncoming()` 解析 JSON 并验证 type 字段
3. 根据 `message.type` 查找匹配的回调函数
4. 执行所有匹配的回调，传入 `(data, message)` 参数
5. 调用 `onMessage()` 钩子供子类使用

### Reconnection Strategy

- 初始延迟：3 秒（`reconnectDelay`）
- 最大延迟：10 秒（`reconnectDelayMax`）
- 最大尝试次数：10 次（`maxReconnectAttempts`）
- 策略：线性退避（delay \* attempts）而非指数退避
- 手动断开时不会触发重连

### Logging System

- **日志级别**：debug (10) < info (20) < warn (30) < error (40) < silent (50)
- **默认级别**：warn（仅输出警告和错误）
- **配置方式**：
  - WebSocketClient: 通过构造函数的 `logLevel` 配置
  - MessageSocket: 通过 `setConfig` 的 `logLevel` 配置
- **日志格式**：`[Name] ...messages`
- **动态调整**：可以通过 `logger.setLevel()` 运行时修改日志级别

### Visibility Management (页面可见性管理)

MessageSocket 支持页面可见性管理功能，用于优化多标签页场景下的连接管理：

- **启用方式**：通过 `setConfig` 的 `enableVisibilityManagement` 配置
- **工作原理**：
  - 监听浏览器的 `visibilitychange` 事件
  - 当标签页不可见时自动断开连接
  - 当标签页重新可见时自动重连
- **使用场景**：
  - 多标签页应用（避免重复连接）
  - 移动端 WebView（页面切换到后台）
  - 需要优化服务器连接数的场景
- **注意事项**：
  - 页面不可见时无法接收消息
  - 如需后台持续接收消息，请勿启用此功能

## Build System

使用 Rollup 构建，特点：

- **自动模块扫描**：自动扫描 `src/` 目录下的所有 `.ts` 文件（排除 index.ts 和 .d.ts）
- **多格式输出**：每个模块生成 ESM (`.esm.js`) 和 CJS (`.cjs.js`) 两种格式
- **独立导出**：支持按需引入（如 `import { MessageSocket } from '@brewer/dj-common/MessageSocket'`）
- **TypeScript 类型**：自动生成 `.d.ts` 类型声明文件

**添加新模块：**
只需在 `src/` 目录下创建新的 `.ts` 文件，构建系统会自动检测并生成对应的输出文件。

## Code Standards

### Commit Convention

严格遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `build`: 构建系统
- `ci`: CI 配置
- `chore`: 其他杂项

**Git Hooks：**

- `pre-commit`: 自动运行 lint-staged（格式化和 lint）
- `commit-msg`: 验证 commit message 格式

### TypeScript Guidelines

- 所有公共 API 必须有完整的类型定义
- 使用接口（interface）定义配置对象和回调参数
- 导出必要的类型供外部使用
- 使用泛型支持自定义消息数据类型

## Release Process

**通过 Claude Code 发布（推荐）：**
只需告诉 Claude："帮我发布一个新版本" 或 "发布 beta 版本 x.x.x"，Claude 会自动处理所有流程。

**手动发布流程：**

1. 确保所有更改已提交
2. 运行 `npm run release:patch/minor/major`（会自动生成 CHANGELOG 和 git tag）
3. 运行 `npm run release:publish`（推送到 GitHub 和 npm）

**GitHub Actions 自动发布：**

- 推送带 `v` 前缀的 tag（如 `v1.0.0`）会触发自动发布
- 需要在仓库设置中配置 `NPM_TOKEN` secret

## Important Files

- `src/WebSocketClient.ts` - WebSocket 基础封装类
- `src/MessageSocket.ts` - 用户消息管理类
- `src/logger.ts` - 日志系统（Logger 类，支持多级别日志）
- `src/index.ts` - 主入口，导出所有公共 API
- `rollup.config.js` - 构建配置，自动扫描模块
- `.versionrc.json` - 版本管理配置（standard-version）
- `commitlint.config.cjs` - Commit 规范配置
- `DEVELOPMENT.md` - 详细的开发指南

## Testing Locally

使用 npm link 在其他项目中测试：

```bash
# 在本项目中
npm link

# 在其他项目中
npm link @brewer/dj-common
```

## Notes

- 这是一个纯工具库，不应包含业务逻辑
- 所有日志都通过 Logger 类输出，可通过 logLevel 配置控制输出级别
- 日志前缀格式：`[WebSocketClient]` 或 `[MessageSocket]`
- 心跳消息默认格式：`{ type: 'PING', timestamp: Date.now() }`
- MessageSocket 使用静态方法，保持全局单例模式
- 对话结束的时候，清除生成的临时无用文件 以tmpclaude-开头的
