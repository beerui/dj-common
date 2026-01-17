# @brewer/dj-common API 文档

> 多端通用的公共方法库 API 文档

## 快速开始

```bash
npm install @brewer/dj-common
```

## 模块列表

### WebSocket 相关

- [WebSocketClient](./api/WebSocketClient.md) - 通用 WebSocket 客户端基类
- [MessageSocket](./api/MessageSocket.md) - 业务层 WebSocket 封装（支持三种连接模式）
- [SharedWorkerManager](./api/SharedWorkerManager.md) - SharedWorker 标签页端管理器

### 工具类

- [Logger](./api/Logger.md) - 轻量级日志管理类

## 使用指南

### 基础使用

#### WebSocketClient 基础示例

```typescript
import { WebSocketClient } from '@brewer/dj-common'

const client = new WebSocketClient({
  url: 'ws://localhost:8080',
  heartbeatInterval: 30000,
  autoReconnect: true,
  enableNetworkListener: true, // 网络恢复时自动重连
})

client.on('message', (data) => {
  console.log('收到消息:', data)
})

client.connect()
```

#### MessageSocket 业务场景示例

```typescript
import { MessageSocket } from '@brewer/dj-common'

// 1. 配置服务器地址
MessageSocket.setConfig({
  url: 'wss://your-server.com/api/websocket/messageServer',
  heartbeatInterval: 25000,
  connectionMode: 'auto', // 自动选择最佳连接模式
})

// 2. 注册消息回调
MessageSocket.setCallbacks([
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
])

// 3. 启动连接
MessageSocket.start({
  userId: '1234567890',
  token: 'your-auth-token',
})

// 4. 动态注册新的回调
MessageSocket.registerCallbacks({
  type: 'NOTIFICATION',
  callback: (payload) => {
    console.log('通知:', payload)
  },
})

// 5. 发送消息
MessageSocket.send({
  type: 'MARK_READ',
  messageId: '123',
})

// 6. 查看当前连接模式
console.log('连接模式:', MessageSocket.getConnectionMode())
// 输出: 'sharedWorker' | 'visibility' | 'normal'

// 7. 停止连接
MessageSocket.stop()
```

### 类型安全

所有模块都提供完整的 TypeScript 类型定义：

```typescript
import { WebSocketClient, WebSocketConfig, MessageData } from '@brewer/dj-common'

const config: WebSocketConfig = {
  heartbeatInterval: 30000,
  maxReconnectAttempts: 10,
  logLevel: 'debug',
  enableNetworkListener: true,
}

const client = new WebSocketClient(config)

client.on<{ content: string }>('message', (data) => {
  // data 类型为 { content: string }
  console.log(data.content)
})
```

## 特性

- **TypeScript** - 完整的类型定义
- **多格式支持** - ESM 和 CommonJS
- **按需引入** - Tree-shaking 支持
- **可配置** - 灵活的配置选项
- **自动重连** - 智能重连机制
- **心跳检测** - 保持连接活性
- **日志系统** - 内置可配置的日志管理
- **SharedWorker 支持** - 多标签页共享连接
- **网络状态监听** - 网络恢复时自动重连

## 连接模式

MessageSocket 支持三种连接模式：

| 模式         | 说明                           | 浏览器支持                |
| ------------ | ------------------------------ | ------------------------- |
| SharedWorker | 所有标签页共享一个连接（推荐） | Chrome, Firefox, Edge     |
| Visibility   | 根据页面可见性自动连接/断开    | 所有现代浏览器            |
| Normal       | 每个标签页独立连接             | 所有支持 WebSocket 浏览器 |

## 相关链接

- [GitHub 仓库](https://github.com/beerui/dj-common)
- [NPM 包](https://www.npmjs.com/package/@brewer/dj-common)
- [更新日志](../CHANGELOG.md)

## 贡献

欢迎贡献代码！请查看项目根目录的 README.md 了解如何参与开发。

## 许可证

MIT © BeerUi
