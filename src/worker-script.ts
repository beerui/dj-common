/**
 * SharedWorker 脚本
 * 管理跨标签页共享的 WebSocket 连接
 * 注意：此文件会被内联为 Blob，不能有任何 import 语句
 */

// ============ 类型定义（复制自 types.ts，避免 import） ============

// 使用普通对象，不使用 TypeScript 语法
const WorkerToTabMessageType = {
  WORKER_READY: 'WORKER_READY',
  WORKER_MESSAGE: 'WORKER_MESSAGE',
  WORKER_CONNECTED: 'WORKER_CONNECTED',
  WORKER_DISCONNECTED: 'WORKER_DISCONNECTED',
  WORKER_ERROR: 'WORKER_ERROR',
  WORKER_AUTH_CONFLICT: 'WORKER_AUTH_CONFLICT',
  WORKER_PONG: 'WORKER_PONG',
}

// TypeScript 类型定义（编译后会被移除）
type WorkerToTabMessageTypeValue = (typeof WorkerToTabMessageType)[keyof typeof WorkerToTabMessageType]

interface TabToWorkerMessage {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any
  tabId: string
  timestamp: number
}

interface WorkerToTabMessage {
  type: WorkerToTabMessageTypeValue | string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any
  timestamp: number
}

interface TabInfo {
  port: MessagePort
  tabId: string
  isVisible: boolean
  registeredTypes: Set<string>
  callbackMap: Map<string, string>
}

interface InitPayload {
  url: string
  userId: string
  token: string
  isVisible: boolean
  config: {
    heartbeatInterval?: number
    maxReconnectAttempts?: number
    reconnectDelay?: number
    reconnectDelayMax?: number
    autoReconnect?: boolean
    logLevel?: string
  }
  sharedWorkerIdleTimeout?: number
}

interface SendPayload {
  data: string | object
}

interface VisibilityPayload {
  isVisible: boolean
}

interface RegisterCallbackPayload {
  type: string
  callbackId: string
}

interface UnregisterCallbackPayload {
  type: string
  callbackId?: string
}

interface ServerMessagePayload {
  data: string
  message: {
    type: string
    data: unknown
    meta?: Record<string, unknown>
    timestamp?: number
  }
}

interface ErrorPayload {
  message: string
  error?: unknown
}

interface AuthConflictPayload {
  currentUserId: string
  newUserId: string
  message: string
}

// ============ WebSocket 管理器 ============

/**
 * WebSocket 管理器
 * 负责管理唯一的 WebSocket 连接和所有标签页
 */
class WebSocketManager {
  /** 标签页列表 (tabId -> TabInfo) */
  private tabs: Map<string, TabInfo> = new Map()

  /** WebSocket 连接实例 */
  private socket: WebSocket | null = null

  /** 空闲定时器 */
  private idleTimer: ReturnType<typeof setTimeout> | null = null

  /** 心跳定时器 */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  /** 重连定时器 */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  /** 重连次数 */
  private reconnectAttempts = 0

  /** 是否手动关闭 */
  private manualClose = false

  /** 当前连接的 URL */
  private currentUrl: string | null = null

  /** 当前用户ID */
  private currentUserId: string | null = null

  /** 配置 */
  private config: InitPayload['config'] | null = null

  /** SharedWorker 空闲超时时间（毫秒） */
  private sharedWorkerIdleTimeout = 30000

  /**
   * 添加标签页
   */
  addTab(port: MessagePort, message: TabToWorkerMessage): void {
    const { tabId, payload } = message
    const initPayload = payload as InitPayload

    // 检查身份冲突
    if (this.currentUserId && this.currentUserId !== initPayload.userId) {
      const conflictPayload: AuthConflictPayload = {
        currentUserId: this.currentUserId,
        newUserId: initPayload.userId,
        message: `检测到不同用户身份：当前连接用户为 ${this.currentUserId}，新标签页尝试使用用户 ${initPayload.userId} 连接。将复用现有连接。`,
      }

      this.sendToTab(port, WorkerToTabMessageType.WORKER_AUTH_CONFLICT, conflictPayload)
      console.warn('[SharedWorker]', conflictPayload.message)
    }

    // 添加标签页信息
    const tabInfo: TabInfo = {
      port,
      tabId,
      isVisible: initPayload.isVisible,
      registeredTypes: new Set(),
      callbackMap: new Map(),
    }

    this.tabs.set(tabId, tabInfo)
    console.log(`[SharedWorker] 标签页已添加: ${tabId}, 当前标签页数量: ${this.tabs.size}`)

    // 如果还没有连接，创建连接
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.currentUrl = `${initPayload.url}/${initPayload.userId}?token=${encodeURIComponent(initPayload.token)}`
      this.currentUserId = initPayload.userId
      this.config = initPayload.config
      this.sharedWorkerIdleTimeout = initPayload.sharedWorkerIdleTimeout ?? 30000

      this.connect()
    } else {
      // 已有连接，直接通知标签页已连接
      this.sendToTab(port, WorkerToTabMessageType.WORKER_CONNECTED, {})
    }

    // 重置空闲定时器
    this.resetIdleTimer()
  }

  /**
   * 移除标签页
   */
  removeTab(tabId: string): void {
    this.tabs.delete(tabId)
    console.log(`[SharedWorker] 标签页已移除: ${tabId}, 剩余标签页数量: ${this.tabs.size}`)

    if (this.tabs.size === 0) {
      // 没有标签页了，开始空闲倒计时
      console.log(`[SharedWorker] 所有标签页已关闭，将在 ${this.sharedWorkerIdleTimeout}ms 后断开连接`)
      this.startIdleTimer()
    } else {
      // 还有标签页，检查可见性
      this.checkAllTabsVisibility()
    }
  }

  /**
   * 更新标签页可见性
   */
  updateTabVisibility(tabId: string, isVisible: boolean): void {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      console.warn(`[SharedWorker] 标签页不存在: ${tabId}`)
      return
    }

    tab.isVisible = isVisible
    console.log(`[SharedWorker] 标签页 ${tabId} 可见性更新: ${isVisible}`)

    this.checkAllTabsVisibility()
  }

  /**
   * 检查所有标签页可见性
   */
  private checkAllTabsVisibility(): void {
    if (this.tabs.size === 0) return

    const allHidden = Array.from(this.tabs.values()).every((tab) => !tab.isVisible)

    if (allHidden) {
      // 所有标签页都不可见，开始空闲倒计时
      console.log(`[SharedWorker] 所有标签页都不可见，将在 ${this.sharedWorkerIdleTimeout}ms 后断开连接`)
      this.startIdleTimer()
    } else {
      // 至少有一个标签页可见，取消倒计时
      console.log('[SharedWorker] 至少有一个标签页可见，保持连接')
      this.resetIdleTimer()
    }
  }

  /**
   * 开始空闲定时器
   */
  private startIdleTimer(): void {
    this.clearIdleTimer()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.idleTimer = (globalThis as any).setTimeout(() => {
      console.log('[SharedWorker] 空闲超时，断开连接')
      this.disconnect()
    }, this.sharedWorkerIdleTimeout)
  }

  /**
   * 重置空闲定时器
   */
  private resetIdleTimer(): void {
    this.clearIdleTimer()
  }

  /**
   * 清除空闲定时器
   */
  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  /**
   * 连接到 WebSocket 服务器
   */
  private connect(): void {
    if (!this.currentUrl) {
      console.error('[SharedWorker] 缺少 WebSocket URL')
      return
    }

    this.manualClose = false

    try {
      this.socket = new WebSocket(this.currentUrl)

      this.socket.onopen = () => {
        console.log('[SharedWorker] ✅ WebSocket 连接成功')
        this.reconnectAttempts = 0
        this.startHeartbeat()

        // 通知所有标签页已连接
        console.log(`[SharedWorker] 通知 ${this.tabs.size} 个标签页: 已连接`)
        this.broadcastToAllTabs(WorkerToTabMessageType.WORKER_CONNECTED, {})
      }

      this.socket.onmessage = (event: MessageEvent) => {
        this.handleIncoming(event.data)
      }

      this.socket.onclose = (event: CloseEvent) => {
        console.log('[SharedWorker] WebSocket 连接关闭', event.code, event.reason)
        this.stopHeartbeat()

        // 通知所有标签页已断开
        this.broadcastToAllTabs(WorkerToTabMessageType.WORKER_DISCONNECTED, {})

        if (!this.manualClose && this.config?.autoReconnect) {
          this.scheduleReconnect()
        }
      }

      this.socket.onerror = (event: Event) => {
        console.error('[SharedWorker] WebSocket 连接错误', event)
        this.stopHeartbeat()

        const errorPayload: ErrorPayload = {
          message: 'WebSocket 连接错误',
          error: event,
        }

        // 通知所有标签页发生错误
        this.broadcastToAllTabs(WorkerToTabMessageType.WORKER_ERROR, errorPayload)
      }
    } catch (error) {
      console.error('[SharedWorker] 创建 WebSocket 连接失败', error)

      const errorPayload: ErrorPayload = {
        message: '创建 WebSocket 连接失败',
        error,
      }

      this.broadcastToAllTabs(WorkerToTabMessageType.WORKER_ERROR, errorPayload)

      if (this.config?.autoReconnect && !this.manualClose) {
        this.scheduleReconnect()
      }
    }
  }

  /**
   * 计划重连
   */
  private scheduleReconnect(): void {
    const maxAttempts = this.config?.maxReconnectAttempts ?? 10
    const reconnectDelay = this.config?.reconnectDelay ?? 3000
    const reconnectDelayMax = this.config?.reconnectDelayMax ?? 10000

    if (this.reconnectAttempts >= maxAttempts || !this.currentUrl || this.manualClose) {
      if (this.reconnectAttempts >= maxAttempts) {
        console.warn('[SharedWorker] 已达到最大重连次数')
      }
      return
    }

    this.reconnectAttempts += 1
    const delay = Math.min(reconnectDelay * this.reconnectAttempts, reconnectDelayMax)

    console.log(`[SharedWorker] 将在 ${delay}ms 后进行第 ${this.reconnectAttempts} 次重连`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.reconnectTimer = (globalThis as any).setTimeout(() => {
      this.connect()
    }, delay)
  }

  /**
   * 断开连接
   */
  private disconnect(): void {
    this.manualClose = true
    this.stopHeartbeat()
    this.clearIdleTimer()

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    this.reconnectAttempts = 0
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()

    const heartbeatInterval = this.config?.heartbeatInterval ?? 25000

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.heartbeatTimer = (globalThis as any).setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return
      }

      // 默认心跳消息
      const heartbeatData = { type: 'PING', timestamp: Date.now() }
      this.send(heartbeatData)
    }, heartbeatInterval)
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 发送消息到服务器
   */
  send(data: string | object): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[SharedWorker] WebSocket 未连接，无法发送消息')
      return
    }

    const message = typeof data === 'string' ? data : JSON.stringify(data)
    this.socket.send(message)
  }

  /**
   * 处理接收的消息
   */
  private handleIncoming(data: string): void {
    if (!data) return

    let message: { type: string; data: unknown; meta?: Record<string, unknown>; timestamp?: number }
    try {
      message = JSON.parse(data)
    } catch {
      console.warn('[SharedWorker] 无法解析消息', data)
      return
    }

    if (!message?.type) {
      return
    }

    console.log(`[SharedWorker] 📨 收到服务器消息, type: ${message.type}`, message)

    // 分发消息到所有注册了该类型的标签页
    const serverMessagePayload: ServerMessagePayload = {
      data,
      message,
    }

    let sentCount = 0
    for (const tab of this.tabs.values()) {
      console.log(`[SharedWorker] 检查标签页 ${tab.tabId}, 注册的类型:`, Array.from(tab.registeredTypes))
      if (tab.registeredTypes.has(message.type)) {
        console.log(`[SharedWorker] ✅ 发送消息到标签页 ${tab.tabId}, type: ${message.type}`)
        this.sendToTab(tab.port, WorkerToTabMessageType.WORKER_MESSAGE, serverMessagePayload)
        sentCount++
      }
    }

    console.log(`[SharedWorker] 消息分发完成, type: ${message.type}, 发送给 ${sentCount} 个标签页`)
  }

  /**
   * 注册回调
   */
  registerCallback(tabId: string, payload: RegisterCallbackPayload): void {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      console.warn(`[SharedWorker] ⚠️ 标签页不存在: ${tabId}`)
      return
    }

    tab.registeredTypes.add(payload.type)
    tab.callbackMap.set(payload.callbackId, payload.type)
    console.log(`[SharedWorker] ✅ 标签页 ${tabId} 注册回调: ${payload.type} (${payload.callbackId})`)
    console.log(`[SharedWorker] 标签页 ${tabId} 当前注册的所有类型:`, Array.from(tab.registeredTypes))
  }

  /**
   * 取消注册回调
   */
  unregisterCallback(tabId: string, payload: UnregisterCallbackPayload): void {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      console.warn(`[SharedWorker] 标签页不存在: ${tabId}`)
      return
    }

    if (payload.callbackId) {
      // 移除特定回调
      const type = tab.callbackMap.get(payload.callbackId)
      if (type) {
        tab.callbackMap.delete(payload.callbackId)

        // 检查是否还有其他回调注册了该类型
        const hasOtherCallbacks = Array.from(tab.callbackMap.values()).some((t) => t === type)
        if (!hasOtherCallbacks) {
          tab.registeredTypes.delete(type)
        }

        console.log(`[SharedWorker] 标签页 ${tabId} 取消注册回调: ${type}`)
      }
    } else {
      // 移除该类型的所有回调
      tab.registeredTypes.delete(payload.type)

      // 移除 callbackMap 中该类型的所有条目
      for (const [callbackId, type] of tab.callbackMap.entries()) {
        if (type === payload.type) {
          tab.callbackMap.delete(callbackId)
        }
      }

      console.log(`[SharedWorker] 标签页 ${tabId} 取消注册所有 ${payload.type} 类型回调`)
    }
  }

  /**
   * 发送消息到特定标签页
   */
  private sendToTab(port: MessagePort, type: WorkerToTabMessageTypeValue | string, payload: unknown): void {
    const message: WorkerToTabMessage = {
      type,
      payload,
      timestamp: Date.now(),
    }

    try {
      port.postMessage(message)
    } catch (error) {
      console.error('[SharedWorker] 发送消息到标签页失败', error)
    }
  }

  /**
   * 广播消息到所有标签页
   */
  private broadcastToAllTabs(type: WorkerToTabMessageTypeValue | string, payload: unknown): void {
    for (const tab of this.tabs.values()) {
      this.sendToTab(tab.port, type, payload)
    }
  }
}

// 创建全局 WebSocket 管理器实例
const wsManager = new WebSocketManager()

/**
 * SharedWorker 连接事件监听
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).onconnect = (event: MessageEvent) => {
  const port = event.ports[0]

  port.onmessage = (e: MessageEvent) => {
    const message = e.data as TabToWorkerMessage
    console.log(`[SharedWorker] 📬 收到标签页消息, type: ${message.type}, tabId: ${message.tabId}`)

    switch (message.type) {
      case 'TAB_INIT':
        wsManager.addTab(port, message)
        break

      case 'TAB_SEND':
        wsManager.send((message.payload as SendPayload).data)
        break

      case 'TAB_VISIBILITY':
        wsManager.updateTabVisibility(message.tabId, (message.payload as VisibilityPayload).isVisible)
        break

      case 'TAB_REGISTER_CALLBACK':
        console.log(`[SharedWorker] 🔔 处理注册回调请求:`, message.payload)
        wsManager.registerCallback(message.tabId, message.payload as RegisterCallbackPayload)
        break

      case 'TAB_UNREGISTER_CALLBACK':
        wsManager.unregisterCallback(message.tabId, message.payload as UnregisterCallbackPayload)
        break

      case 'TAB_DISCONNECT':
        wsManager.removeTab(message.tabId)
        break

      case 'TAB_PING':
        // 响应 PING
        port.postMessage({
          type: 'WORKER_PONG',
          timestamp: Date.now(),
        })
        break

      default:
        console.warn('[SharedWorker] 未知消息类型', message.type)
    }
  }

  port.start()
}
