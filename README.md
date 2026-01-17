# @brewer/dj-common

多端通用的公共方法库，支持 PC、H5、APP 等平台。使用 TypeScript 编写，提供完整的类型支持。

## 特性

- **TypeScript** - 完全使用 TypeScript 编写，提供完整的类型定义
- **多格式支持** - 同时提供 ESM 和 CommonJS 两种格式
- **按需引入** - 支持独立引入模块，减小打包体积
- **可配置** - 所有参数都可灵活配置
- **自动重连** - 内置智能重连机制
- **心跳检测** - 自动维持连接活性
- **日志系统** - 内置可配置的日志系统，支持多级别控制
- **类型安全** - 完整的 TypeScript 类型支持
- **SharedWorker 支持** - 多标签页共享 WebSocket 连接，优化资源使用
- **网络状态监听** - 网络恢复时自动重连

## 安装

```bash
npm install @brewer/dj-common
# 或
yarn add @brewer/dj-common
# 或
pnpm add @brewer/dj-common
```

## 按需引入

你可以单独引入某个模块：

```typescript
// 只引入 WebSocketClient
import { WebSocketClient } from '@brewer/dj-common/WebSocketClient'

// 只引入 MessageSocket
import { MessageSocket } from '@brewer/dj-common/MessageSocket'

// 只引入 Logger
import { Logger } from '@brewer/dj-common/logger'
```

## TypeScript 支持

本库完全使用 TypeScript 编写，提供完整的类型定义：

```typescript
import type {
  WebSocketConfig,
  MessageData,
  MessageCallback,
  MessageCallbackEntry,
  MessageSocketConfig,
  MessageSocketStartOptions,
  LogLevel,
} from '@brewer/dj-common'
```

## 浏览器兼容性

支持所有现代浏览器：

- Chrome >= 60
- Firefox >= 60
- Safari >= 11
- Edge >= 79

## 开发

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 代码检查
npm run lint

# 代码格式化
npm run format

# 构建
npm run build
```

## 发布

使用 Claude Code 时只需发送 "帮我发布一个新版本" 即可自动完成发布流程。

```bash
# 自动版本管理和发布
npm run release:patch  # 补丁版本 1.0.0 -> 1.0.1
npm run release:minor  # 次版本 1.0.0 -> 1.1.0
npm run release:major  # 主版本 1.0.0 -> 2.0.0

# 推送到远程
git push --follow-tags origin main

# 发布到 npm
npm publish
```

## 架构设计

```
@brewer/dj-common
├── WebSocketClient (基础类)
│   ├── 连接管理（connect/disconnect）
│   ├── 心跳检测（自动发送 PING）
│   ├── 自动重连（指数退避策略）
│   ├── 消息回调系统（type-based routing）
│   ├── 日志系统（可配置的日志级别）
│   ├── 网络状态监听（网络恢复时自动重连）
│   └── 生命周期钩子（onOpen/onClose/onError/onMessage）
│
├── MessageSocket (业务类 - 静态单例)
│   ├── 用户认证（userId + token）
│   ├── URL 构建
│   ├── 全局消息管理
│   ├── 三种连接模式（sharedWorker / visibility / normal）
│   └── 自动降级策略
│
├── SharedWorkerManager (标签页端管理器)
│   ├── 创建和管理 SharedWorker
│   ├── MessagePort 通信
│   ├── 页面可见性监听
│   └── 网络状态监听
│
├── worker-script (SharedWorker 脚本)
│   ├── 管理跨标签页共享的 WebSocket 连接
│   ├── 消息广播
│   └── 空闲超时管理
│
└── Logger (日志类)
    ├── 多级别日志（debug/info/warn/error/silent）
    ├── 优先级控制
    └── 带名称前缀的日志输出
```

**设计理念：**

- `WebSocketClient` 是通用的 WebSocket 基础封装，不依赖具体业务
- `MessageSocket` 基于 `WebSocketClient`，添加用户认证等业务功能
- `SharedWorkerManager` 管理 SharedWorker 连接，实现跨标签页共享
- `Logger` 提供统一的日志管理，支持多级别控制
- 职责分离，易于扩展和维护

## 日志系统

库内置了日志系统，支持 5 种日志级别：

- `debug` - 调试信息（最详细）
- `info` - 一般信息
- `warn` - 警告信息（默认级别）
- `error` - 错误信息
- `silent` - 静默模式（不输出任何日志）

### 配置日志级别

**WebSocketClient:**

```typescript
import { WebSocketClient } from '@brewer/dj-common'

const client = new WebSocketClient({
  url: 'ws://localhost:8080',
  logLevel: 'debug', // 设置日志级别
})
```

**MessageSocket:**

```typescript
import { MessageSocket } from '@brewer/dj-common'

MessageSocket.setConfig({
  url: 'ws://localhost:8080/api/websocket/messageServer',
  logLevel: 'info', // 设置日志级别
})
```

### 使用独立的 Logger

你也可以在自己的代码中使用 Logger：

```typescript
import { Logger } from '@brewer/dj-common'

const logger = new Logger('MyApp', 'debug')

logger.debug('调试信息')
logger.info('普通信息')
logger.warn('警告信息')
logger.error('错误信息')

// 动态修改日志级别
logger.setLevel('warn')
```

## 多标签页管理

在 Web 应用中，用户可能会在多个标签页打开同一个应用。为了优化 WebSocket 连接的使用，库提供了三种连接模式：

### 1. SharedWorker 模式（推荐）

**默认启用**。使用 SharedWorker 在所有标签页之间共享一个 WebSocket 连接，是最优的多标签页解决方案。

```typescript
import { MessageSocket } from '@brewer/dj-common'

MessageSocket.setConfig({
  url: 'wss://your-server.com/api/websocket/messageServer',
  // connectionMode: 'auto', // 默认值，自动启用 SharedWorker
})

MessageSocket.start({
  userId: '123',
  token: 'your-token',
})
```

**优势：**

- 所有标签页共享一个 WebSocket 连接
- 任意标签页可见时保持连接，避免频繁断连
- 所有标签页不可见时等待 30 秒才断开（可配置）
- 节省服务器资源，减少连接数
- 用户体验流畅，切换标签页不会中断连接

**空闲超时配置：**

```typescript
MessageSocket.setConfig({
  sharedWorkerIdleTimeout: 60000, // 60 秒（默认 30 秒）
})
```

### 2. Visibility 模式（降级）

浏览器不支持 SharedWorker 时自动降级到此模式，或可显式启用：

```typescript
MessageSocket.setConfig({
  url: 'wss://your-server.com/api/websocket/messageServer',
  connectionMode: 'visibility', // 显式使用 Visibility 模式
  enableVisibilityManagement: true, // 必须启用
})
```

**行为：**

- 当标签页切换到后台时，自动断开 WebSocket 连接
- 当标签页切换到前台时，自动重新连接

### 3. Normal 模式

每个标签页独立维持自己的 WebSocket 连接：

```typescript
MessageSocket.setConfig({
  url: 'wss://your-server.com/api/websocket/messageServer',
  connectionMode: 'normal', // 显式使用 Normal 模式
})
```

### 连接模式对比

| 模式         | 连接数 | 切换标签页 | 后台接收消息 | 浏览器兼容性                |
| ------------ | ------ | ---------- | ------------ | --------------------------- |
| SharedWorker | 1 个   | 保持连接   | 是           | Chrome, Firefox, Edge       |
| Visibility   | 1 个   | 断开/重连  | 否           | 所有支持 Visibility API     |
| Normal       | N 个   | 保持连接   | 是           | 所有支持 WebSocket 的浏览器 |

### 查看当前模式

```typescript
const mode = MessageSocket.getConnectionMode()
console.log('当前连接模式:', mode) // 'sharedWorker' | 'visibility' | 'normal'
```

**适用场景：**

- 用户可能打开多个标签页的应用
- 需要优化服务器连接数的场景
- 移动端 WebView 应用（页面切换到后台）

## 网络状态监听

库内置了网络状态监听功能，解决移动端断网较久后无法自动重连的问题：

- 监听 `online`/`offline` 事件
- 网络恢复时自动重置重连计数并立即重连
- 默认启用，可通过 `enableNetworkListener: false` 关闭

```typescript
// WebSocketClient
const client = new WebSocketClient({
  url: 'ws://localhost:8080',
  enableNetworkListener: true, // 默认 true
})

// MessageSocket（通过 SharedWorker 或直接连接都支持）
MessageSocket.setConfig({
  url: 'wss://your-server.com/api/websocket/messageServer',
  // enableNetworkListener 默认为 true
})
```

## 本地测试

```bash
npm link
# 在包中
pnpm unlink --global
pnpm link --global && echo "===== 重新 link 完成 ====="
# 使用处
pnpm unlink @brewer/dj-common
pnpm link --global @brewer/dj-common
```

### Worker 测试

`chrome://inspect/#workers`

## License

MIT

---

**Made with BeerUi**
