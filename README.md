# @brewer/dj-common

多端通用的公共方法库，支持 PC、H5、APP 等平台。使用 TypeScript 编写，提供完整的类型支持。

## ✨ 特性

- 📘 **TypeScript** - 完全使用 TypeScript 编写，提供完整的类型定义
- 📦 **多格式支持** - 同时提供 ESM 和 CommonJS 两种格式
- 🔌 **按需引入** - 支持独立引入模块，减小打包体积
- 🔧 **可配置** - 所有参数都可灵活配置
- 🔄 **自动重连** - 内置智能重连机制
- 💓 **心跳检测** - 自动维持连接活性
- 🎯 **类型安全** - 完整的 TypeScript 类型支持

## 安装

```bash
npm install @brewer/dj-common
# 或
yarn add @brewer/dj-common
# 或
pnpm add @brewer/dj-common
```

## 功能模块

### WebSocketClient - WebSocket 基础封装类

通用的 WebSocket 客户端，不依赖于具体业务，提供连接管理、心跳、自动重连等基础功能。

#### 使用示例

```typescript
import { WebSocketClient } from '@brewer/dj-common'

// 创建实例
const client = new WebSocketClient({
  heartbeatInterval: 30000, // 心跳间隔
  maxReconnectAttempts: 10, // 最大重连次数
  reconnectDelay: 3000, // 重连延迟
  autoReconnect: true, // 自动重连
})

// 注册消息回调
client.on('MESSAGE_TYPE', (data, message) => {
  console.log('收到消息:', data)
})

// 连接
client.connect('ws://example.com/ws')

// 发送消息
client.send({ type: 'HELLO', data: 'world' })

// 断开连接
client.disconnect()
```

#### API 说明

##### 配置选项

```typescript
interface WebSocketConfig {
  url?: string // WebSocket 服务器地址
  heartbeatInterval?: number // 心跳间隔（毫秒），默认 25000
  maxReconnectAttempts?: number // 最大重连次数，默认 10
  reconnectDelay?: number // 重连延迟（毫秒），默认 3000
  reconnectDelayMax?: number // 最大重连延迟（毫秒），默认 10000
  heartbeatMessage?: () => string | object // 心跳消息生成器
  autoReconnect?: boolean // 是否自动重连，默认 true
}
```

##### 方法

- `connect(url?: string): void` - 连接到 WebSocket 服务器
- `disconnect(): void` - 断开连接
- `send(data: string | object): void` - 发送消息
- `on(type, callback): void` - 注册消息回调
- `off(type, callback?): void` - 取消注册消息回调
- `clearCallbacks(): void` - 清空所有回调
- `isConnected(): boolean` - 是否已连接
- `getReadyState(): number` - 获取当前连接状态

---

### MessageSocket - 消息 Socket 管理类

基于 WebSocketClient 的用户消息管理类，适用于需要用户认证的场景（如获取用户未读消息数量）。

#### 使用示例

```typescript
import { MessageSocket } from '@brewer/dj-common'

// 可选：自定义配置
MessageSocket.configure({
  baseUrl: 'ws://your-server.com',
  path: '/your/path',
  heartbeatInterval: 30000,
})

// 启动连接
MessageSocket.start({
  userId: '1234567890',
  token: 'your-token',
  callbacks: [
    {
      type: 'UNREAD_COUNT',
      callback: (payload) => {
        console.log('未读消息数:', payload)
      },
    },
    {
      type: 'NEW_MESSAGE',
      callback: (payload) => {
        console.log('新消息:', payload)
      },
    },
  ],
})

// 动态注册回调
MessageSocket.registerCallbacks({
  type: 'NOTIFICATION',
  callback: (payload) => {
    console.log('通知:', payload)
  },
})

// 发送消息
MessageSocket.send({ type: 'MARK_READ', messageId: '123' })

// 停止连接
MessageSocket.stop()
```

#### API 说明

##### 配置选项

```typescript
interface MessageSocketConfig extends WebSocketConfig {
  baseUrl?: string // WebSocket 服务器基础地址，默认 'ws://dev-gateway.chinamarket.cn'
  path?: string // WebSocket 路径，默认 '/api/user-web/websocket/messageServer'
}
```

##### 方法

- `configure(config): void` - 配置 MessageSocket
- `start(options): void` - 启动连接
- `stop(): void` - 停止连接
- `registerCallbacks(entry): void` - 注册消息回调
- `unregisterCallbacks(type, callback?): void` - 取消注册消息回调
- `send(data): void` - 发送消息
- `isConnected(): boolean` - 是否已连接
- `getCurrentUserId(): string | null` - 获取当前用户ID
- `getCurrentToken(): string | null` - 获取当前token

---

## 按需引入

你可以单独引入某个模块：

```typescript
// 只引入 WebSocketClient
import { WebSocketClient } from '@brewer/dj-common/WebSocketClient'

// 只引入 MessageSocket
import { MessageSocket } from '@brewer/dj-common/MessageSocket'
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
│   └── 生命周期钩子
│
└── MessageSocket (业务类)
    ├── 继承 WebSocketClient
    ├── 用户认证
    └── 消息管理
```

**设计理念：**

- `WebSocketClient` 是通用的 WebSocket 基础封装，不依赖具体业务
- `MessageSocket` 基于 `WebSocketClient`，添加用户认证等业务功能
- 职责分离，易于扩展和维护

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
