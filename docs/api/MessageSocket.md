# MessageSocket

> 基于 WebSocketClient 的业务层 WebSocket 封装，提供更便捷的消息处理和状态管理

## 安装

```bash
npm install @brewer/dj-common
```

## 导入

```typescript
import { MessageSocket } from '@brewer/dj-common'
// 或
import MessageSocket from '@brewer/dj-common/MessageSocket'
```

## 概述

`MessageSocket` 是对 `WebSocketClient` 的业务层封装，提供了：

- 📨 简化的消息收发 API
- 🔄 连接状态管理
- 🎯 类型安全的消息处理
- 🛠️ 常用业务场景的快捷方法

## API

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

## 相关链接

- [GitHub 仓库](https://github.com/beerui/dj-common)
- [NPM 包](https://www.npmjs.com/package/@brewer/dj-common)
- [WebSocketClient API](./WebSocketClient.md)
