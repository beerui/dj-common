# MessageSocket 消息触达业务方法

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

##### 基础使用流程

```typescript
import { MessageSocket } from '@brewer/dj-common'

// 1. 配置服务器地址（可选，如果使用默认配置可跳过）
MessageSocket.setConfig({
  baseUrl: 'ws://your-server.com', // 必填
  path: '/api/websocket/messageServer', // 必填
  heartbeatInterval: 25000,
  autoReconnect: true,
  maxReconnectAttempts: 10,
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

// 6. 检查连接状态
if (MessageSocket.isConnected()) {
  console.log('WebSocket 已连接')
}

// 7. 获取当前用户信息
const userId = MessageSocket.getCurrentUserId()
const token = MessageSocket.getCurrentToken()

// 8. 取消注册回调
MessageSocket.unregisterCallbacks('NOTIFICATION')

// 9. 停止连接
MessageSocket.stop()
```

##### 简化写法（链式调用）

```typescript
import { MessageSocket } from '@brewer/dj-common'

// 配置和回调可以链式调用
MessageSocket.setConfig({
  baseUrl: 'ws://your-server.com',
  path: '/api/websocket/messageServer',
}).setCallbacks([
  {
    type: 'UNREAD_COUNT',
    callback: (payload) => console.log('未读:', payload),
  },
])

// 然后启动
MessageSocket.start({
  userId: '1234567890',
  token: 'your-auth-token',
})
```

##### 类型安全的消息处理

```typescript
import { MessageSocket, MessageCallbackEntry } from '@brewer/dj-common'

// 定义消息类型
interface UnreadCountData {
  count: number
  lastMessageTime: string
}

interface NewMessageData {
  id: string
  content: string
  senderId: string
  timestamp: string
}

// 类型安全的回调
const callbacks: MessageCallbackEntry[] = [
  {
    type: 'UNREAD_COUNT',
    callback: (data: UnreadCountData) => {
      console.log(`未读消息: ${data.count}`)
      console.log(`最后消息时间: ${data.lastMessageTime}`)
    },
  },
  {
    type: 'NEW_MESSAGE',
    callback: (data: NewMessageData) => {
      console.log(`新消息来自 ${data.senderId}: ${data.content}`)
    },
  },
]

MessageSocket.setCallbacks(callbacks)
```

##### React 组件中使用

```typescript
import { useEffect } from 'react'
import { MessageSocket } from '@brewer/dj-common'

function MessageComponent() {
  useEffect(() => {
    // 配置并启动
    MessageSocket
      .setConfig({
        baseUrl: 'ws://your-server.com',
        path: '/api/websocket/messageServer',
      })
      .setCallbacks([
        {
          type: 'UNREAD_COUNT',
          callback: (data) => {
            // 更新 UI 状态
            console.log('未读消息:', data)
          }
        }
      ])

    MessageSocket.start({
      userId: user.id,
      token: user.token,
    })

    // 清理
    return () => {
      MessageSocket.stop()
    }
  }, [user.id, user.token])

  return <div>消息组件</div>
}
```

#### API 说明

##### 配置选项

```typescript
interface MessageSocketConfig extends WebSocketConfig {
  /** WebSocket 服务器基础地址 */
  baseUrl?: string
  /** WebSocket 路径 */
  path?: string
  /** 心跳间隔（毫秒），默认 25000 */
  heartbeatInterval?: number
  /** 最大重连次数，默认 10 */
  maxReconnectAttempts?: number
  /** 重连延迟（毫秒），默认 3000 */
  reconnectDelay?: number
  /** 最大重连延迟（毫秒），默认 10000 */
  reconnectDelayMax?: number
  /** 是否自动重连，默认 true */
  autoReconnect?: boolean
  /** 初始消息回调列表 */
  callbacks?: MessageCallbackEntry[]
}
```

##### 启动选项

```typescript
interface MessageSocketStartOptions {
  /** 用户ID（必需） */
  userId: string
  /** 认证令牌（必需） */
  token: string
}
```

##### 静态方法

**配置相关**

- `setConfig(config: Partial<MessageSocketConfig>): MessageSocket`
  - 设置 MessageSocket 配置
  - 支持链式调用
  - 如果配置中包含 callbacks，会自动注册

- `configure(config: Partial<MessageSocketConfig>): void`
  - 配置 MessageSocket（不支持链式调用）
  - 功能与 `setConfig` 相同

**连接管理**

- `start(options: MessageSocketStartOptions): void`
  - 启动 WebSocket 连接
  - 参数：
    - `userId`: 用户ID（必需）
    - `token`: 认证令牌（必需）
  - 自动构建 WebSocket URL: `{baseUrl}{path}/{userId}?token={token}`
  - 如果已存在相同用户的连接，会复用现有连接

- `stop(): void`
  - 停止连接并清理所有回调
  - 清空当前用户信息

**回调管理**

- `setCallbacks(callbacks: MessageCallbackEntry[]): MessageSocket`
  - 批量设置消息回调
  - 支持链式调用
  - 会调用 `registerCallbacks` 逐个注册

- `registerCallbacks<T>(entry: MessageCallbackEntry<T>): void`
  - 注册单个消息回调
  - 泛型参数 `T` 指定消息数据类型
  - 参数：
    - `type`: 消息类型（字符串）
    - `callback`: 回调函数 `(data: T, message?: unknown) => void`

- `unregisterCallbacks<T>(type: string, callback?: (data: T, message?: unknown) => void): void`
  - 取消注册消息回调
  - 如果不提供 `callback`，会移除该类型的所有回调
  - 如果提供 `callback`，只移除匹配的回调

**消息发送**

- `send(data: string | object): void`
  - 发送消息到服务器
  - 参数可以是字符串或对象
  - 如果是对象，会自动转换为 JSON 字符串

**状态查询**

- `isConnected(): boolean`
  - 检查是否已连接
  - 返回 `true` 表示连接正常

- `getReadyState(): number`
  - 获取 WebSocket 连接状态
  - 返回值对应 WebSocket 的 readyState:
    - `0` (CONNECTING): 正在连接
    - `1` (OPEN): 已连接
    - `2` (CLOSING): 正在关闭
    - `3` (CLOSED): 已关闭

- `getCurrentUserId(): string | null`
  - 获取当前连接的用户ID
  - 未连接时返回 `null`

- `getCurrentToken(): string | null`
  - 获取当前连接的认证令牌
  - 未连接时返回 `null`

##### 消息回调类型

```typescript
interface MessageCallbackEntry<T = unknown> {
  /** 消息类型 */
  type: string
  /** 回调函数 */
  callback: (data: T, message?: unknown) => void
}
```

## 使用场景

### 场景 1: 实时未读消息提醒

```typescript
import { MessageSocket } from '@brewer/dj-common'

// 初始化消息服务
MessageSocket.setConfig({
  baseUrl: 'ws://your-server.com',
  path: '/api/websocket/messageServer',
}).setCallbacks([
  {
    type: 'UNREAD_COUNT',
    callback: (data: { count: number }) => {
      // 更新 UI 显示未读消息数
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
    // 显示消息通知
    showNotification({
      title: `来自 ${data.sender} 的新消息`,
      body: data.content,
    })

    // 播放提示音
    playNotificationSound()
  },
})
```

### 场景 3: 用户切换

```typescript
// 用户登出时停止连接
function logout() {
  MessageSocket.stop()
  // 清理其他状态...
}

// 用户登录时启动连接
function login(userId: string, token: string) {
  MessageSocket.start({ userId, token })
}

// 切换用户（自动复用或重新连接）
function switchUser(newUserId: string, newToken: string) {
  // MessageSocket.start 会自动处理旧连接
  MessageSocket.start({
    userId: newUserId,
    token: newToken,
  })
}
```

## 注意事项

### 1. 配置顺序

必须先调用 `setConfig` 设置 `baseUrl` 和 `path`，然后才能调用 `start`：

```typescript
// ✅ 正确
MessageSocket.setConfig({
  baseUrl: 'ws://server.com',
  path: '/ws',
})
MessageSocket.start({ userId, token })

// ❌ 错误 - 会警告缺少配置
MessageSocket.start({ userId, token })
```

### 2. 回调注册时机

回调可以在启动前或启动后注册：

```typescript
// 启动前注册（推荐）
MessageSocket.setCallbacks([...])
MessageSocket.start({ userId, token })

// 启动后动态注册（也可以）
MessageSocket.start({ userId, token })
MessageSocket.registerCallbacks({ type: 'NEW_TYPE', callback: ... })
```

### 3. 连接复用

相同用户的重复调用 `start` 会复用现有连接：

```typescript
MessageSocket.start({ userId: '123', token: 'abc' })
MessageSocket.start({ userId: '123', token: 'abc' }) // 复用连接，不会重新建立

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
onMounted(() => {
  MessageSocket.start({ userId, token })
})
onUnmounted(() => {
  MessageSocket.stop()
})
```

### 5. 错误处理

MessageSocket 内部会打印警告日志，但不会抛出异常：

```typescript
// 这些调用不会抛出异常，只会打印警告
MessageSocket.start({ userId: '', token: '' }) // 警告: 缺少参数
MessageSocket.send({}) // 未连接时警告
MessageSocket.registerCallbacks({ type: '', callback: null }) // 警告: 参数无效
```

### 6. 类型安全

充分利用 TypeScript 的类型系统：

```typescript
// 定义消息类型
interface MessagePayload {
  type: 'UNREAD_COUNT' | 'NEW_MESSAGE' | 'NOTIFICATION'
  data: unknown
}

// 类型安全的回调
MessageSocket.registerCallbacks<{ count: number }>({
  type: 'UNREAD_COUNT',
  callback: (data) => {
    // data 类型为 { count: number }
    console.log(data.count)
  },
})
```

---

## 相关链接

- [GitHub 仓库](https://github.com/beerui/dj-common)
- [NPM 包](https://www.npmjs.com/package/@brewer/dj-common)
- [WebSocketClient API](./WebSocketClient.md)
