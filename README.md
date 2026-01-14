# @brewer/dj-common

多端通用的公共方法库，支持 PC、H5、APP 等平台。使用 TypeScript 编写，提供完整的类型支持。

## ✨ 特性

- 📘 **TypeScript** - 完全使用 TypeScript 编写，提供完整的类型定义
- 📦 **多格式支持** - 同时提供 ESM 和 CommonJS 两种格式
- 🔌 **按需引入** - 支持独立引入模块，减小打包体积
- 🔧 **可配置** - 所有参数都可灵活配置
- 🔄 **自动重连** - 内置智能重连机制
- 💓 **心跳检测** - 自动维持连接活性
- 📝 **日志系统** - 内置可配置的日志系统，支持多级别控制
- 🎯 **类型安全** - 完整的 TypeScript 类型支持

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

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 代码格式化
npm run format

# 构建
npm run build
```

## 发布

使用claude code时 只需发送 "帮我发布一个新版本" 即可

推送消息必须要是：`chore: bump version to 1.0.0-beta.7`

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
│   ├── 连接管理
│   ├── 心跳检测
│   ├── 自动重连
│   ├── 消息回调
│   ├── 日志系统
│   └── 生命周期钩子
│
├── MessageSocket (业务类)
│   ├── 继承 WebSocketClient
│   ├── 用户认证
│   └── 消息管理
│
└── Logger (日志类)
    ├── 多级别日志（debug/info/warn/error/silent）
    ├── 可配置日志级别
    └── 带名称前缀
```

**设计理念：**

- `WebSocketClient` 是通用的 WebSocket 基础封装，不依赖具体业务
- `MessageSocket` 基于 `WebSocketClient`，添加用户认证等业务功能
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
  url: 'ws://localhost:8080',
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

## 本地测试

```ts
npm link
# 在其他项目中
npm link @brewer/dj-common
```

## License

MIT

---

**Made with ❤️ by BeerUi**
