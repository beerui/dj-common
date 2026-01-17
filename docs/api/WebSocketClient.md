# WebSocketClient

> 通用的 WebSocket 客户端类，提供连接管理、心跳检测、自动重连等基础功能

## 安装

```bash
npm install @brewer/dj-common
```

## 导入

```typescript
import { WebSocketClient } from '@brewer/dj-common'
// 或
import WebSocketClient from '@brewer/dj-common/WebSocketClient'
```

## 概述

`WebSocketClient` 是一个不依赖于具体业务的 WebSocket 客户端基类，提供了：

- 连接管理（连接、断开、重连）
- 心跳检测机制
- 自动重连（可配置重连策略）
- 消息收发和回调管理
- 可配置的日志系统
- 连接状态追踪
- 网络状态监听（网络恢复时自动重连）

## API

### 构造函数

```typescript
constructor(config?: WebSocketConfig)
```

创建 WebSocketClient 实例。

**参数**：

| 参数名 | 类型            | 必填 | 默认值 | 说明           |
| ------ | --------------- | ---- | ------ | -------------- |
| config | WebSocketConfig | 否   | {}     | WebSocket 配置 |

**示例**：

```typescript
const client = new WebSocketClient({
  heartbeatInterval: 30000, // 30秒心跳
  maxReconnectAttempts: 10, // 最多重连10次
  reconnectDelay: 3000, // 重连延迟3秒
  autoReconnect: true, // 启用自动重连
  logLevel: 'warn', // 日志级别（debug/info/warn/error/silent）
  enableNetworkListener: true, // 网络状态监听（默认 true）
})
```

### connect()

```typescript
connect(url?: string): void
```

连接到 WebSocket 服务器。

**参数**：

| 参数名 | 类型   | 必填 | 默认值 | 说明                                   |
| ------ | ------ | ---- | ------ | -------------------------------------- |
| url    | string | 否   | -      | WebSocket 服务器地址（可在配置中指定） |

**示例**：

```typescript
client.connect('ws://localhost:8080')
// 或使用配置中的 URL
client.connect()
```

### disconnect()

```typescript
disconnect(): void
```

主动断开 WebSocket 连接，不会触发自动重连。

**示例**：

```typescript
client.disconnect()
```

### send()

```typescript
send(data: string | object): void
```

发送消息到服务器。

**参数**：

| 参数名 | 类型             | 必填 | 默认值 | 说明                                 |
| ------ | ---------------- | ---- | ------ | ------------------------------------ |
| data   | string \| object | 是   | -      | 消息数据，对象会自动转为 JSON 字符串 |

**示例**：

```typescript
// 发送对象
client.send({ type: 'user-message', content: 'Hello' })

// 发送字符串
client.send('ping')
```

### on()

```typescript
on<T = unknown>(type: string, callback: MessageCallback<T>): void
```

注册消息回调函数。

**参数**：

| 参数名   | 类型                | 必填 | 默认值 | 说明     |
| -------- | ------------------- | ---- | ------ | -------- |
| type     | string              | 是   | -      | 消息类型 |
| callback | MessageCallback\<T> | 是   | -      | 回调函数 |

**示例**：

```typescript
client.on('user-message', (data, message) => {
  console.log('收到消息:', data)
  console.log('完整消息:', message)
})
```

### off()

```typescript
off(type: string, callback?: MessageCallback): void
```

移除消息回调函数。

**参数**：

| 参数名   | 类型            | 必填 | 默认值 | 说明                                       |
| -------- | --------------- | ---- | ------ | ------------------------------------------ |
| type     | string          | 是   | -      | 消息类型                                   |
| callback | MessageCallback | 否   | -      | 要移除的回调函数，不传则移除该类型所有回调 |

**示例**：

```typescript
// 移除特定回调
client.off('user-message', handler)

// 移除该类型所有回调
client.off('user-message')
```

### clearCallbacks()

```typescript
clearCallbacks(): void
```

清空所有回调。

**示例**：

```typescript
client.clearCallbacks()
```

### updateConfig()

```typescript
updateConfig(config: Partial<WebSocketConfig>): void
```

更新配置。

**参数**：

| 参数名 | 类型                      | 必填 | 默认值 | 说明       |
| ------ | ------------------------- | ---- | ------ | ---------- |
| config | Partial\<WebSocketConfig> | 是   | -      | 新的配置项 |

**示例**：

```typescript
client.updateConfig({
  logLevel: 'debug',
  heartbeatInterval: 15000,
})
```

### getReadyState()

```typescript
getReadyState(): number
```

获取当前 WebSocket 连接状态。

**返回值**：

- `0` (CONNECTING): 正在连接
- `1` (OPEN): 已连接
- `2` (CLOSING): 正在关闭
- `3` (CLOSED): 已关闭

### isConnected()

```typescript
isConnected(): boolean
```

检查是否已连接。

**返回值**：`true` 表示连接正常（readyState === OPEN）

## 类型定义

### WebSocketConfig

WebSocket 配置选项

```typescript
interface WebSocketConfig {
  /** WebSocket 服务器地址（可选，可以在 connect 时指定） */
  url?: string
  /** 心跳间隔（毫秒），默认 25000 */
  heartbeatInterval?: number
  /** 最大重连次数，默认 10 */
  maxReconnectAttempts?: number
  /** 重连延迟（毫秒），默认 3000 */
  reconnectDelay?: number
  /** 最大重连延迟（毫秒），默认 10000 */
  reconnectDelayMax?: number
  /** 心跳消息生成器 */
  heartbeatMessage?: () => string | object
  /** 是否自动重连，默认 true */
  autoReconnect?: boolean
  /** 日志级别，默认 'warn' */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent'
  /** 是否启用网络状态监听（网络恢复时自动重连），默认 true */
  enableNetworkListener?: boolean
}
```

### MessageData\<T>

消息数据结构

```typescript
interface MessageData<T = unknown> {
  /** 消息类型 */
  type: string
  /** 消息数据 */
  data: T
  /** 元数据 */
  meta?: Record<string, unknown>
  /** 时间戳 */
  timestamp?: number
}
```

### MessageCallback\<T>

消息回调函数类型

```typescript
type MessageCallback<T = unknown> = (data: T, message?: MessageData<T>) => void
```

## 完整示例

```typescript
import { WebSocketClient } from '@brewer/dj-common'

// 创建客户端实例
const client = new WebSocketClient({
  heartbeatInterval: 30000,
  maxReconnectAttempts: 5,
  reconnectDelay: 3000,
  autoReconnect: true,
  logLevel: 'debug',
  enableNetworkListener: true, // 网络恢复时自动重连
})

// 注册消息回调
client.on('chat-message', (data) => {
  console.log('收到聊天消息:', data)
})

client.on('system-notification', (data) => {
  console.log('系统通知:', data)
})

// 连接到服务器
client.connect('ws://localhost:8080')

// 发送消息
client.send({
  type: 'chat-message',
  content: 'Hello, World!',
  userId: '123',
})

// 主动断开连接
// client.disconnect()
```

## 网络状态监听

WebSocketClient 内置了网络状态监听功能，默认启用：

- 监听浏览器的 `online` 和 `offline` 事件
- 网络断开时，暂停重连定时器（避免浪费重连次数）
- 网络恢复时，自动重置重连计数并立即尝试重连
- 特别适用于移动端断网较久后无法自动重连的场景

```typescript
// 启用（默认）
const client = new WebSocketClient({
  enableNetworkListener: true,
})

// 禁用
const client = new WebSocketClient({
  enableNetworkListener: false,
})
```

## 使用场景

### 1. 简单聊天应用

```typescript
const chatClient = new WebSocketClient()

chatClient.on('message', (data) => {
  displayMessage(data)
})

chatClient.connect('ws://chat.example.com')

function sendMessage(text: string) {
  chatClient.send({ type: 'message', text, timestamp: Date.now() })
}
```

### 2. 实时数据监控

```typescript
const monitor = new WebSocketClient({
  heartbeatInterval: 10000, // 10秒心跳
})

monitor.on('metrics', (data) => {
  updateDashboard(data)
})

monitor.connect('ws://monitor.example.com/metrics')
```

### 3. 游戏实时通信

```typescript
const gameClient = new WebSocketClient({
  heartbeatInterval: 5000, // 5秒心跳
  maxReconnectAttempts: 20, // 游戏中多次重连
})

gameClient.on('player-action', (action) => {
  handlePlayerAction(action)
})

gameClient.on('game-state', (state) => {
  updateGameState(state)
})

gameClient.connect('ws://game.example.com')
```

## 注意事项

1. **连接地址**：确保提供有效的 WebSocket URL（`ws://` 或 `wss://`）
2. **资源清理**：不再使用时调用 `disconnect()` 清理资源
3. **消息格式**：服务器返回的消息需要包含 `type` 字段
4. **心跳机制**：可以通过 `heartbeatMessage` 自定义心跳消息格式
5. **重连策略**：可以通过配置调整重连次数和延迟
6. **日志控制**：通过 `logLevel` 配置控制日志输出级别，生产环境建议设置为 `'warn'` 或 `'error'`
7. **网络监听**：默认启用网络状态监听，移动端断网恢复后会自动重连

## 相关链接

- [GitHub 仓库](https://github.com/beerui/dj-common)
- [NPM 包](https://www.npmjs.com/package/@brewer/dj-common)
- [MessageSocket API](./MessageSocket.md)
- [SharedWorkerManager API](./SharedWorkerManager.md)
- [CHANGELOG](../../CHANGELOG.md)
