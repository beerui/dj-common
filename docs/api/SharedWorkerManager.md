# SharedWorkerManager

> SharedWorker 标签页端管理器，负责在标签页中创建和管理 SharedWorker 连接

## 概述

`SharedWorkerManager` 是 MessageSocket 在 SharedWorker 模式下使用的内部管理器。它负责：

- 创建和管理 SharedWorker 实例
- 通过 MessagePort 与 Worker 通信
- 管理消息回调
- 监听页面可见性变化
- 监听网络状态变化

**注意**：通常情况下，你不需要直接使用 `SharedWorkerManager`，而是通过 `MessageSocket` 来使用 SharedWorker 功能。当 `MessageSocket` 的 `connectionMode` 设置为 `'auto'` 或 `'sharedWorker'` 时，会自动使用 `SharedWorkerManager`。

## 工作原理

```
┌─────────────────────────────────────────────────────────────────┐
│                        浏览器                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   标签页 1    │  │   标签页 2    │  │   标签页 3    │          │
│  │              │  │              │  │              │          │
│  │ SharedWorker │  │ SharedWorker │  │ SharedWorker │          │
│  │   Manager    │  │   Manager    │  │   Manager    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         │  MessagePort    │  MessagePort    │  MessagePort      │
│         │                 │                 │                   │
│         └────────────────┬┴─────────────────┘                   │
│                          │                                      │
│                ┌─────────▼─────────┐                           │
│                │   SharedWorker    │                           │
│                │  (worker-script)  │                           │
│                │                   │                           │
│                │   单一 WebSocket  │                           │
│                │       连接        │                           │
│                └─────────┬─────────┘                           │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
                    WebSocket 服务器
```

## 导入

```typescript
import { SharedWorkerManager } from '@brewer/dj-common'
```

## 配置选项

### SharedWorkerManagerConfig

```typescript
interface SharedWorkerManagerConfig {
  /** WebSocket 服务器地址 */
  url: string
  /** 用户 ID */
  userId: string
  /** 认证令牌 */
  token: string
  /** 页面是否可见 */
  isVisible: boolean
  /** WebSocket 配置 */
  config: WebSocketConfig
  /** SharedWorker 空闲超时时间（毫秒），默认 30000 */
  sharedWorkerIdleTimeout?: number
  /** 日志级别 */
  logLevel?: LogLevel
  /** 启动时强制新建 SharedWorker */
  forceNewWorkerOnStart?: boolean
}
```

## API

### 构造函数

```typescript
constructor(config: SharedWorkerManagerConfig)
```

创建 SharedWorkerManager 实例。

### start()

```typescript
async start(): Promise<boolean>
```

启动 SharedWorker 连接。返回 `true` 表示启动成功。

### stop()

```typescript
stop(): void
```

停止当前标签页的 SharedWorker 连接（不影响其他标签页）。

### forceShutdown()

```typescript
forceShutdown(): void
```

强制关闭 Worker（会影响所有标签页，用于退出登录场景）。

### send()

```typescript
send(data: string | object): void
```

发送消息到服务器。

### registerCallback()

```typescript
registerCallback<T = unknown>(entry: MessageCallbackEntry<T>): string
```

注册消息回调，返回回调 ID。

### unregisterCallback()

```typescript
unregisterCallback(type: string, callback?: MessageCallback): void
```

取消注册消息回调。

### clearCallbacks()

```typescript
clearCallbacks(): void
```

清空所有回调。

### isConnected()

```typescript
isConnected(): boolean
```

检查是否已连接。

### onConnected()

```typescript
onConnected(callback: () => void): void
```

设置连接成功回调。

### onDisconnected()

```typescript
onDisconnected(callback: () => void): void
```

设置断开连接回调。

### onError()

```typescript
onError(callback: (error: ErrorPayload) => void): void
```

设置错误回调。

### onAuthConflict()

```typescript
onAuthConflict(callback: (conflict: AuthConflictPayload) => void): void
```

设置身份冲突回调（当不同标签页使用不同用户连接时触发）。

## 通信协议

SharedWorkerManager 与 Worker 之间通过消息协议通信：

### 标签页 -> Worker 消息类型

| 类型                    | 说明                   |
| ----------------------- | ---------------------- |
| TAB_INIT                | 初始化连接             |
| TAB_DISCONNECT          | 断开当前标签页         |
| TAB_SEND                | 发送消息到服务器       |
| TAB_VISIBILITY          | 页面可见性变化         |
| TAB_REGISTER_CALLBACK   | 注册回调               |
| TAB_UNREGISTER_CALLBACK | 取消注册回调           |
| TAB_PING                | 心跳（检测标签页存活） |
| TAB_FORCE_SHUTDOWN      | 强制关闭 Worker        |
| TAB_FORCE_RESET         | 强制重置 Worker 状态   |
| TAB_NETWORK_ONLINE      | 网络恢复               |

### Worker -> 标签页 消息类型

| 类型                 | 说明             |
| -------------------- | ---------------- |
| WORKER_CONNECTED     | WebSocket 已连接 |
| WORKER_DISCONNECTED  | WebSocket 已断开 |
| WORKER_MESSAGE       | 收到服务器消息   |
| WORKER_ERROR         | 发生错误         |
| WORKER_AUTH_CONFLICT | 身份冲突         |
| WORKER_PONG          | 心跳响应         |

## 使用示例

### 通过 MessageSocket 使用（推荐）

```typescript
import { MessageSocket } from '@brewer/dj-common'

// 自动使用 SharedWorker 模式
MessageSocket.setConfig({
  url: 'wss://your-server.com/api/websocket/messageServer',
  connectionMode: 'auto', // 默认值，自动启用 SharedWorker
})

MessageSocket.setCallbacks([
  {
    type: 'NEW_MESSAGE',
    callback: (data) => console.log('新消息:', data),
  },
])

MessageSocket.start({
  userId: '123',
  token: 'your-token',
})
```

### 直接使用（高级）

```typescript
import { SharedWorkerManager } from '@brewer/dj-common'

const manager = new SharedWorkerManager({
  url: 'wss://your-server.com/api/websocket/messageServer',
  userId: '123',
  token: 'your-token',
  isVisible: true,
  config: {
    heartbeatInterval: 25000,
    autoReconnect: true,
  },
  sharedWorkerIdleTimeout: 30000,
  logLevel: 'debug',
})

// 设置回调
manager.onConnected(() => {
  console.log('连接成功')
})

manager.onDisconnected(() => {
  console.log('连接断开')
})

manager.onError((error) => {
  console.error('错误:', error)
})

// 启动
const success = await manager.start()

if (success) {
  // 注册消息回调
  manager.registerCallback({
    type: 'NEW_MESSAGE',
    callback: (data) => console.log('新消息:', data),
  })

  // 发送消息
  manager.send({ type: 'PING' })
}

// 停止
manager.stop()
```

## 空闲超时

当所有标签页都不可见时，SharedWorker 会等待一段时间后再断开 WebSocket 连接。这样可以：

- 避免用户快速切换标签页时频繁断连/重连
- 在用户短暂离开后仍能接收消息

```typescript
MessageSocket.setConfig({
  sharedWorkerIdleTimeout: 60000, // 60 秒（默认 30 秒）
})
```

## 网络状态监听

SharedWorkerManager 会监听网络状态变化：

- 网络断开时，Worker 会暂停重连尝试
- 网络恢复时，通知 Worker 立即尝试重连

## 调试

可以在 Chrome 中通过以下地址查看 SharedWorker：

```
chrome://inspect/#workers
```

## 注意事项

1. **浏览器兼容性**：SharedWorker 在 Safari 中不支持，会自动降级到其他模式
2. **同源策略**：SharedWorker 只能被同源页面共享
3. **生命周期**：当所有连接的标签页都关闭时，SharedWorker 会被终止
4. **内存管理**：关闭标签页时会自动清理对应的连接

## 相关链接

- [MessageSocket API](./MessageSocket.md)
- [WebSocketClient API](./WebSocketClient.md)
- [MDN - SharedWorker](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker)
