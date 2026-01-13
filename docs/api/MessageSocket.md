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

### 构造函数

```typescript
constructor(config?: WebSocketConfig)
```

创建 MessageSocket 实例。

**参数**：

| 参数名 | 类型            | 必填 | 默认值 | 说明           |
| ------ | --------------- | ---- | ------ | -------------- |
| config | WebSocketConfig | 否   | {}     | WebSocket 配置 |

**示例**：

```typescript
const socket = new MessageSocket({
  url: 'ws://localhost:8080',
  heartbeatInterval: 30000,
  autoReconnect: true,
})
```

### connect()

```typescript
connect(url?: string): void
```

连接到 WebSocket 服务器。

**示例**：

```typescript
socket.connect('ws://localhost:8080')
```

### send()

```typescript
send(type: string, data?: unknown): void
```

发送消息。

**示例**：

```typescript
socket.send('chat', { message: 'Hello' })
```

### on()

```typescript
on<T = unknown>(event: string, callback: MessageCallback<T>): void
```

注册消息监听器。

**示例**：

```typescript
socket.on('message', (data) => {
  console.log(data)
})
```

### off()

```typescript
off(event: string, callback?: MessageCallback): void
```

移除消息监听器。

**示例**：

```typescript
socket.off('message', handler)
```

### disconnect()

```typescript
disconnect(): void
```

断开连接。

**示例**：

```typescript
socket.disconnect()
```

### destroy()

```typescript
destroy(): void
```

销毁实例。

**示例**：

```typescript
socket.destroy()
```

## 完整示例

```typescript
import { MessageSocket } from '@brewer/dj-common'

// 创建实例
const socket = new MessageSocket({
  heartbeatInterval: 30000,
  autoReconnect: true,
})

// 注册消息处理
socket.on('chat-message', (data) => {
  console.log('收到聊天消息:', data)
})

// 连接
socket.connect('ws://localhost:8080')

// 发送消息
socket.send('chat-message', {
  content: 'Hello!',
})

// 清理
socket.destroy()
```

## 相关链接

- [GitHub 仓库](https://github.com/beerui/dj-common)
- [NPM 包](https://www.npmjs.com/package/@brewer/dj-common)
- [WebSocketClient API](./WebSocketClient.md)
