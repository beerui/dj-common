# MessageSocket 消息触达业务方法

> 基于 WebSocketClient 的业务层 WebSocket 封装，支持三种连接模式，提供更便捷的消息处理和状态管理

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

- 简化的消息收发 API
- 连接状态管理
- 类型安全的消息处理
- 三种连接模式（SharedWorker / Visibility / Normal）
- 自动降级策略
- 网络状态监听

## 连接模式

MessageSocket 支持三种连接模式，以适应不同的使用场景：

| 模式         | 说明                              | 优势                     | 浏览器支持                |
| ------------ | --------------------------------- | ------------------------ | ------------------------- |
| SharedWorker | 所有标签页共享一个 WebSocket 连接 | 节省资源，后台可接收消息 | Chrome, Firefox, Edge     |
| Visibility   | 根据页面可见性自动连接/断开       | 节省资源                 | 所有现代浏览器            |
| Normal       | 每个标签页独立维持连接            | 兼容性好，后台可接收消息 | 所有支持 WebSocket 浏览器 |

## 基础使用

```typescript
import { MessageSocket } from '@brewer/dj-common'

// 1. 配置服务器地址
MessageSocket.setConfig({
  url: 'wss://your-server.com/api/websocket/messageServer',
  heartbeatInterval: 25000,
  autoReconnect: true,
  maxReconnectAttempts: 10,
  connectionMode: 'auto', // 自动选择最佳模式（默认）
  logLevel: 'warn',
})

// 2. 注册消息回调（在启动前设置）
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

// 7. 检查连接状态
if (MessageSocket.isConnected()) {
  console.log('WebSocket 已连接')
}

// 8. 获取当前用户信息
const userId = MessageSocket.getCurrentUserId()
const token = MessageSocket.getCurrentToken()

// 9. 取消注册回调
MessageSocket.unregisterCallbacks('NOTIFICATION')

// 10. 停止连接
MessageSocket.stop()
```

## API

### setConfig()

```typescript
static setConfig(config: Partial<MessageSocketConfig>): typeof MessageSocket
```

设置 MessageSocket 配置，支持链式调用。

**参数**：

| 参数名 | 类型                          | 必填 | 说明     |
| ------ | ----------------------------- | ---- | -------- |
| config | Partial\<MessageSocketConfig> | 是   | 配置选项 |

**示例**：

```typescript
MessageSocket.setConfig({
  url: 'wss://your-server.com/api/websocket/messageServer',
  connectionMode: 'auto',
  logLevel: 'debug',
})
```

### setCallbacks()

```typescript
static setCallbacks(callbacks: MessageCallbackEntry[]): typeof MessageSocket
```

批量设置消息回调，支持链式调用。

**参数**：

| 参数名    | 类型                   | 必填 | 说明     |
| --------- | ---------------------- | ---- | -------- |
| callbacks | MessageCallbackEntry[] | 是   | 回调列表 |

**示例**：

```typescript
MessageSocket.setCallbacks([
  { type: 'UNREAD_COUNT', callback: (data) => console.log(data) },
  { type: 'NEW_MESSAGE', callback: (data) => console.log(data) },
])
```

### start()

```typescript
static start(options: MessageSocketStartOptions): void
```

启动 WebSocket 连接。

**参数**：

| 参数名  | 类型                      | 必填 | 说明     |
| ------- | ------------------------- | ---- | -------- |
| options | MessageSocketStartOptions | 是   | 启动选项 |

**示例**：

```typescript
MessageSocket.start({
  userId: '1234567890',
  token: 'your-auth-token',
})
```

### stop()

```typescript
static stop(): void
```

停止连接并清理所有回调。

### registerCallbacks()

```typescript
static registerCallbacks<T = unknown>(entry: MessageCallbackEntry<T>): void
```

注册单个消息回调。

**参数**：

| 参数名 | 类型                    | 必填 | 说明     |
| ------ | ----------------------- | ---- | -------- |
| entry  | MessageCallbackEntry<T> | 是   | 回调配置 |

### unregisterCallbacks()

```typescript
static unregisterCallbacks<T = unknown>(type: string, callback?: Function): void
```

取消注册消息回调。如果不提供 `callback`，会移除该类型的所有回调。

### send()

```typescript
static send(data: string | object): void
```

发送消息到服务器。

### isConnected()

```typescript
static isConnected(): boolean
```

检查是否已连接。

### getReadyState()

```typescript
static getReadyState(): number
```

获取 WebSocket 连接状态。

### getConnectionMode()

```typescript
static getConnectionMode(): 'sharedWorker' | 'visibility' | 'normal'
```

获取当前连接模式。

### getCurrentUserId()

```typescript
static getCurrentUserId(): string | null
```

获取当前连接的用户 ID。

### getCurrentToken()

```typescript
static getCurrentToken(): string | null
```

获取当前连接的认证令牌。

## 类型定义

### MessageSocketConfig

```typescript
interface MessageSocketConfig extends WebSocketConfig {
  /** WebSocket 服务器完整地址 */
  url?: string
  /** 消息回调列表 */
  callbacks?: MessageCallbackEntry[]
  /** 日志级别，默认 'warn' */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent'
  /** 是否启用页面可见性管理，默认 false */
  enableVisibilityManagement?: boolean
  /** 连接模式，默认 'auto' */
  connectionMode?: 'auto' | 'sharedWorker' | 'visibility' | 'normal'
  /** SharedWorker 空闲超时时间（毫秒），默认 30000 */
  sharedWorkerIdleTimeout?: number
  /** 启动时强制新建 SharedWorker，默认 false */
  forceNewWorkerOnStart?: boolean
  /** 是否启用网络状态监听，默认 true */
  enableNetworkListener?: boolean
}
```

### MessageSocketStartOptions

```typescript
interface MessageSocketStartOptions {
  /** 用户ID（必需） */
  userId: string
  /** 认证令牌（必需） */
  token: string
}
```

### MessageCallbackEntry

```typescript
interface MessageCallbackEntry<T = unknown> {
  /** 消息类型 */
  type: string
  /** 回调函数 */
  callback: (data: T, message?: unknown) => void
}
```

## 连接模式详解

### SharedWorker 模式（推荐）

所有标签页共享一个 WebSocket 连接，默认启用。

```typescript
MessageSocket.setConfig({
  url: 'wss://your-server.com/api/websocket/messageServer',
  connectionMode: 'auto', // 或 'sharedWorker'
  sharedWorkerIdleTimeout: 30000, // 所有标签页不可见后等待 30 秒才断开
})
```

**特点**：

- 所有标签页共享一个连接
- 切换标签页不会断开连接
- 所有标签页都能接收消息
- 节省服务器资源

### Visibility 模式

根据页面可见性自动管理连接。

```typescript
MessageSocket.setConfig({
  url: 'wss://your-server.com/api/websocket/messageServer',
  connectionMode: 'visibility',
  enableVisibilityManagement: true,
})
```

**特点**：

- 标签页不可见时自动断开
- 标签页可见时自动重连
- 节省资源但会有短暂断连

### Normal 模式

每个标签页独立连接。

```typescript
MessageSocket.setConfig({
  url: 'wss://your-server.com/api/websocket/messageServer',
  connectionMode: 'normal',
})
```

**特点**：

- 每个标签页独立维持连接
- 兼容性最好
- 所有标签页后台都能接收消息

## 使用场景

### 场景 1: 实时未读消息提醒

```typescript
import { MessageSocket } from '@brewer/dj-common'

MessageSocket.setConfig({
  url: 'wss://your-server.com/api/websocket/messageServer',
}).setCallbacks([
  {
    type: 'UNREAD_COUNT',
    callback: (data: { count: number }) => {
      updateBadge(data.count)
    },
  },
])

MessageSocket.start({
  userId: currentUser.id,
  token: currentUser.token,
})
```

### 场景 2: 实时消息推送

```typescript
MessageSocket.registerCallbacks({
  type: 'NEW_MESSAGE',
  callback: (data: { id: string; content: string; sender: string }) => {
    showNotification({
      title: `来自 ${data.sender} 的新消息`,
      body: data.content,
    })
    playNotificationSound()
  },
})
```

### 场景 3: React 组件中使用

```typescript
import { useEffect } from 'react'
import { MessageSocket } from '@brewer/dj-common'

function MessageComponent({ user }) {
  useEffect(() => {
    MessageSocket.setConfig({
      url: 'wss://your-server.com/api/websocket/messageServer',
    }).setCallbacks([
      {
        type: 'UNREAD_COUNT',
        callback: (data) => {
          console.log('未读消息:', data)
        },
      },
    ])

    MessageSocket.start({
      userId: user.id,
      token: user.token,
    })

    return () => {
      MessageSocket.stop()
    }
  }, [user.id, user.token])

  return <div>消息组件</div>
}
```

### 场景 4: Vue 组件中使用

```typescript
import { onMounted, onUnmounted } from 'vue'
import { MessageSocket } from '@brewer/dj-common'

export default {
  setup() {
    onMounted(() => {
      MessageSocket.setConfig({
        url: 'wss://your-server.com/api/websocket/messageServer',
      })
      MessageSocket.start({ userId, token })
    })

    onUnmounted(() => {
      MessageSocket.stop()
    })
  },
}
```

## 注意事项

### 1. 配置顺序

必须先调用 `setConfig` 设置 `url`，然后才能调用 `start`：

```typescript
// ✅ 正确
MessageSocket.setConfig({ url: 'wss://server.com/ws' })
MessageSocket.start({ userId, token })

// ❌ 错误 - 会报错缺少配置
MessageSocket.start({ userId, token })
```

### 2. URL 格式

URL 应包含完整路径，`start` 时会自动追加用户认证参数：

```typescript
// 配置的 URL
url: 'wss://server.com/api/websocket/messageServer'

// 实际连接的 URL（自动生成）
// wss://server.com/api/websocket/messageServer/{userId}?token={token}
```

### 3. 连接复用

相同用户的重复调用 `start` 会复用现有连接：

```typescript
MessageSocket.start({ userId: '123', token: 'abc' })
MessageSocket.start({ userId: '123', token: 'abc' }) // 复用连接

MessageSocket.start({ userId: '456', token: 'xyz' }) // 新用户，会先停止旧连接
```

### 4. 内存清理

在组件卸载或页面销毁时，记得停止连接：

```typescript
// React
useEffect(() => {
  MessageSocket.start({ userId, token })
  return () => MessageSocket.stop()
}, [])

// Vue
onUnmounted(() => {
  MessageSocket.stop()
})
```

### 5. 日志控制

```typescript
// 开启详细日志（用于调试）
MessageSocket.setConfig({ logLevel: 'debug' })

// 生产环境（仅输出错误）
MessageSocket.setConfig({ logLevel: 'error' })

// 静默模式
MessageSocket.setConfig({ logLevel: 'silent' })
```

## 相关链接

- [GitHub 仓库](https://github.com/beerui/dj-common)
- [NPM 包](https://www.npmjs.com/package/@brewer/dj-common)
- [WebSocketClient API](./WebSocketClient.md)
- [SharedWorkerManager API](./SharedWorkerManager.md)
