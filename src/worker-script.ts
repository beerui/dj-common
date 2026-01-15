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
  /** 最近一次收到该标签页心跳/消息的时间戳 */
  lastSeen: number
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

interface ForceShutdownPayload {
  reason?: string
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

  /** 最近一次服务器消息缓存（按 type） */
  private lastMessageByType: Map<string, ServerMessagePayload> = new Map()

  /** 标签页清理定时器（回收已关闭/崩溃的标签页） */
  private tabCleanupTimer: ReturnType<typeof setInterval> | null = null

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

  /** 当前 token（用于判断登录态变化） */
  private currentToken: string | null = null

  /** 当前 baseUrl（用于判断环境/域名变化） */
  private currentBaseUrl: string | null = null

  /** 上次连接打开时间 */
  private lastOpenAt = 0

  /** 连续快速被服务端正常关闭(1000)次数 */
  private fastClose1000Count = 0

  /** 自动重连熔断到期时间戳（ms） */
  private reconnectSuppressedUntil = 0

  /** 配置 */
  private config: InitPayload['config'] | null = null

  /** SharedWorker 空闲超时时间（毫秒） */
  private sharedWorkerIdleTimeout = 30000

  /** tab 超时时间（毫秒）：超过该时间未心跳则认为已关闭 */
  private tabStaleTimeout = 45000

  /**
   * 是否存在可见标签页
   */
  private hasVisibleTab(): boolean {
    return Array.from(this.tabs.values()).some((tab) => tab.isVisible)
  }

  /**
   * 清理重连定时器
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * 启动 tab 清理（兜底：页面强制关闭/崩溃未发送 TAB_DISCONNECT 时也能回收）
   */
  private startTabCleanup(): void {
    if (this.tabCleanupTimer !== null) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.tabCleanupTimer = (globalThis as any).setInterval(() => {
      const now = Date.now()
      const staleTabIds: string[] = []
      for (const tab of this.tabs.values()) {
        if (now - tab.lastSeen > this.tabStaleTimeout) {
          staleTabIds.push(tab.tabId)
        }
      }

      if (staleTabIds.length > 0) {
        console.warn('[SharedWorker] 检测到过期标签页，将清理:', staleTabIds)
        staleTabIds.forEach((id) => this.removeTab(id))
      }
    }, 15000)
  }

  private stopTabCleanup(): void {
    if (this.tabCleanupTimer !== null) {
      clearInterval(this.tabCleanupTimer)
      this.tabCleanupTimer = null
    }
  }

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
      lastSeen: Date.now(),
      registeredTypes: new Set(),
      callbackMap: new Map(),
    }

    this.tabs.set(tabId, tabInfo)
    console.log(`[SharedWorker] 标签页已添加: ${tabId}, 当前标签页数量: ${this.tabs.size}`)
    this.startTabCleanup()

    // 计算本次期望连接参数（允许登录后 token 更新 / 切换账号）
    const nextBaseUrl = initPayload.url
    const nextUserId = initPayload.userId
    const nextToken = initPayload.token
    const nextUrl = `${nextBaseUrl}/${nextUserId}?token=${encodeURIComponent(nextToken)}`

    const hasExistingIdentity =
      this.currentBaseUrl !== null ||
      this.currentUserId !== null ||
      this.currentToken !== null ||
      this.currentUrl !== null
    const identityChanged =
      (this.currentBaseUrl !== null && this.currentBaseUrl !== nextBaseUrl) ||
      (this.currentUserId !== null && this.currentUserId !== nextUserId) ||
      (this.currentToken !== null && this.currentToken !== nextToken) ||
      (this.currentUrl !== null && this.currentUrl !== nextUrl)

    if (!hasExistingIdentity || identityChanged) {
      if (hasExistingIdentity) {
        const conflictPayload: AuthConflictPayload = {
          currentUserId: this.currentUserId ?? '',
          newUserId: nextUserId,
          message:
            `检测到连接身份/参数变化：` +
            `oldUser=${this.currentUserId ?? 'null'} -> newUser=${nextUserId}, ` +
            `oldBaseUrl=${this.currentBaseUrl ?? 'null'} -> newBaseUrl=${nextBaseUrl}, ` +
            `tokenChanged=${this.currentToken ? this.currentToken !== nextToken : true}。` +
            `将切换到最新登录态并重建连接。`,
        }
        // 通知所有标签页：登录态变化（方便页面自行处理旧会话）
        this.broadcastToAllTabs(WorkerToTabMessageType.WORKER_AUTH_CONFLICT, conflictPayload)
        console.warn('[SharedWorker]', conflictPayload.message)
      }

      // 更新为最新的连接参数
      this.currentBaseUrl = nextBaseUrl
      this.currentUserId = nextUserId
      this.currentToken = nextToken
      this.currentUrl = nextUrl
      this.config = initPayload.config
      this.sharedWorkerIdleTimeout = initPayload.sharedWorkerIdleTimeout ?? 30000

      // 登录态切换：清空缓存（避免新 tab 回放到旧数据）
      this.lastMessageByType.clear()

      // 断开旧 socket（如果有），由后续 checkAllTabsVisibility 决定是否立即用新参数连接
      if (this.socket) {
        console.log('[SharedWorker] 检测到登录态变化，断开旧连接以使用新参数')
        this.disconnect()
      }
    } else {
      // 未变化时，仅更新配置/超时时间（允许新 tab 提供更完整配置）
      this.config = initPayload.config
      this.sharedWorkerIdleTimeout = initPayload.sharedWorkerIdleTimeout ?? this.sharedWorkerIdleTimeout
    }

    // 若已有连接，直接通知该标签页
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.sendToTab(port, WorkerToTabMessageType.WORKER_CONNECTED, {})
    }

    // 检查所有标签页可见性，决定是否需要保持连接/发起连接
    this.checkAllTabsVisibility()
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
      this.clearReconnectTimer()
      this.stopTabCleanup()
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
    tab.lastSeen = Date.now()
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
      // 不要在后台持续重连（容易造成频繁断开/重连、也会影响新标签页复用）
      this.clearReconnectTimer()
      this.startIdleTimer()
    } else {
      // 至少有一个标签页可见，取消倒计时
      console.log('[SharedWorker] 至少有一个标签页可见，保持连接')
      this.resetIdleTimer()

      // 检查连接状态，如果未连接则重新连接
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        if (this.currentUrl) {
          console.log('[SharedWorker] 检测到连接已断开，标签页可见，尝试重新连接')
          this.connect()
        }
      }
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

    // 熔断：短时间内被服务端频繁正常关闭时，暂停自动重连，避免打爆服务端/刷屏
    if (Date.now() < this.reconnectSuppressedUntil) {
      console.warn('[SharedWorker] 自动重连已熔断，暂不连接', {
        suppressedUntil: this.reconnectSuppressedUntil,
      })
      return
    }

    // 没有可见标签页时，不主动连接（等 TAB_VISIBILITY 变为 true 再连）
    if (!this.hasVisibleTab()) {
      console.log('[SharedWorker] 当前无可见标签页，跳过连接')
      return
    }

    // 避免重复 connect
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.manualClose = false
    this.clearReconnectTimer()

    try {
      this.socket = new WebSocket(this.currentUrl)

      this.socket.onopen = () => {
        console.log('[SharedWorker] ✅ WebSocket 连接成功')
        this.reconnectAttempts = 0
        this.lastOpenAt = Date.now()
        this.fastClose1000Count = 0
        this.startHeartbeat()

        // 通知所有标签页已连接
        console.log(`[SharedWorker] 通知 ${this.tabs.size} 个标签页: 已连接`)
        this.broadcastToAllTabs(WorkerToTabMessageType.WORKER_CONNECTED, {})
      }

      this.socket.onmessage = (event: MessageEvent) => {
        this.handleIncoming(event.data)
      }

      this.socket.onclose = (event: CloseEvent) => {
        const now = Date.now()
        const liveMs = this.lastOpenAt ? now - this.lastOpenAt : -1
        console.log('[SharedWorker] WebSocket 连接关闭', {
          code: event.code,
          reason: event.reason,
          wasClean: (event as any).wasClean,
          liveMs,
        })
        this.stopHeartbeat()

        // 通知所有标签页已断开
        this.broadcastToAllTabs(WorkerToTabMessageType.WORKER_DISCONNECTED, {})

        // 诊断：服务端正常关闭(1000)且“快速关闭”，多半是服务端策略（鉴权失败/单连接踢线/频控等）
        if (event.code === 1000 && liveMs >= 0 && liveMs < 3000) {
          this.fastClose1000Count += 1
          console.warn('[SharedWorker] 检测到快速 1000 关闭', {
            fastClose1000Count: this.fastClose1000Count,
            liveMs,
          })

          // 连续快速关闭达到阈值：熔断 60s 并广播错误给页面，避免无限重连
          if (this.fastClose1000Count >= 3) {
            this.reconnectSuppressedUntil = now + 60000
            const errorPayload: ErrorPayload = {
              message:
                'WebSocket 被服务端频繁正常关闭(1000)，已临时暂停自动重连 60s。请检查 token/服务端是否限制同账号多连接/是否需要额外鉴权消息。',
              error: {
                code: event.code,
                reason: event.reason,
                liveMs,
              },
            }
            this.broadcastToAllTabs(WorkerToTabMessageType.WORKER_ERROR, errorPayload)
            return
          }
        } else {
          // 非快速 1000，重置计数
          this.fastClose1000Count = 0
        }

        // 仅在「有可见标签页」时才自动重连（避免后台空转重连）
        if (!this.manualClose && this.config?.autoReconnect && this.tabs.size > 0 && this.hasVisibleTab()) {
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
    // 后台/无标签页时不重连，等待可见标签页触发 connect()
    if (this.tabs.size === 0 || !this.hasVisibleTab()) {
      return
    }

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

    this.clearReconnectTimer()
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

    this.clearReconnectTimer()

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

    // 缓存该类型最后一条消息，便于新标签页/晚注册回调能立即拿到最新状态
    this.lastMessageByType.set(message.type, serverMessagePayload)

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

    tab.lastSeen = Date.now()
    tab.registeredTypes.add(payload.type)
    tab.callbackMap.set(payload.callbackId, payload.type)
    console.log(`[SharedWorker] ✅ 标签页 ${tabId} 注册回调: ${payload.type} (${payload.callbackId})`)
    console.log(`[SharedWorker] 标签页 ${tabId} 当前注册的所有类型:`, Array.from(tab.registeredTypes))

    // 回放该类型的最后一条消息（如果有），确保新开标签页能立刻拿到最新数据
    const cached = this.lastMessageByType.get(payload.type)
    if (cached) {
      console.log(`[SharedWorker] 🔁 回放缓存消息到标签页 ${tabId}, type: ${payload.type}`)
      this.sendToTab(tab.port, WorkerToTabMessageType.WORKER_MESSAGE, cached)
    }
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

    tab.lastSeen = Date.now()
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

  /**
   * 强制重置 Worker 状态：断开 WebSocket、清空状态，但不终止 Worker
   * 用于 forceNewWorkerOnStart 场景，让 Worker 重新接受新的连接参数
   */
  forceReset(reason?: string): void {
    console.warn('[SharedWorker] 🔄 收到强制重置指令，正在重置 Worker 状态', { reason })

    // 断开 WebSocket（手动关闭，防止自动重连）
    this.disconnect()

    // 清理缓存/状态
    this.lastMessageByType.clear()
    this.currentUrl = null
    this.currentBaseUrl = null
    this.currentUserId = null
    this.currentToken = null

    // 通知所有标签页已断开（但不关闭端口，让它们可以重新初始化）
    this.broadcastToAllTabs(WorkerToTabMessageType.WORKER_DISCONNECTED, {})

    console.log('[SharedWorker] ✅ Worker 状态已重置，等待新的连接参数')
  }

  /**
   * 强制关闭 Worker：断开 WebSocket、清空状态、关闭所有端口
   * 用于"退出登录/强制重置连接"，避免旧 worker 持有旧 token 影响新会话
   */
  forceShutdown(reason?: string): void {
    console.warn('[SharedWorker] ⚠️ 收到强制关闭指令，正在关闭 Worker', { reason })

    // 先断开 WebSocket（手动关闭，防止自动重连）
    this.disconnect()

    // 清理缓存/状态
    this.lastMessageByType.clear()
    this.currentUrl = null
    this.currentBaseUrl = null
    this.currentUserId = null
    this.currentToken = null

    // 关闭所有端口并清空 tabs
    for (const tab of this.tabs.values()) {
      try {
        tab.port.postMessage({
          type: WorkerToTabMessageType.WORKER_DISCONNECTED,
          payload: {},
          timestamp: Date.now(),
        })
      } catch {
        // 忽略发送消息失败（端口可能已关闭）
      }
      try {
        tab.port.close()
      } catch {
        // 忽略关闭端口失败
      }
    }
    this.tabs.clear()

    this.stopTabCleanup()

    // 显式终止 SharedWorker（否则可能在 DevTools 里仍显示存活一段时间）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workerClose = (globalThis as any).close as undefined | (() => void)
    if (typeof workerClose === 'function') {
      console.warn('[SharedWorker] 🛑 正在终止 SharedWorker 进程')
      try {
        workerClose()
      } catch (error) {
        console.warn('[SharedWorker] 终止 SharedWorker 失败', error)
      }
    }
  }

  /**
   * 处理网络恢复事件
   * 重置重连计数并立即尝试重连
   */
  handleNetworkOnline(): void {
    console.log('[SharedWorker] 🌐 收到网络恢复通知')

    // 如果已连接，无需重连
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('[SharedWorker] 已有活跃连接，无需重连')
      return
    }

    // 重置重连计数
    this.reconnectAttempts = 0

    // 清除可能存在的重连定时器
    this.clearReconnectTimer()

    // 重置熔断状态
    this.reconnectSuppressedUntil = 0

    // 如果有可见标签页且有 URL，立即尝试重连
    if (this.currentUrl && this.hasVisibleTab()) {
      console.log('[SharedWorker] 网络恢复，立即尝试重连')
      this.connect()
    } else {
      console.log('[SharedWorker] 网络恢复，但无可见标签页或无 URL，等待条件满足')
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
    // 更新该标签页最后活跃时间（心跳/任意消息都算）
    const tab = (wsManager as any).tabs?.get?.(message.tabId) as TabInfo | undefined
    if (tab) tab.lastSeen = Date.now()

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
        // 响应 PING（tab 侧心跳）
        port.postMessage({
          type: 'WORKER_PONG',
          timestamp: Date.now(),
        })
        break

      case 'TAB_FORCE_RESET':
        wsManager.forceReset((message.payload as ForceShutdownPayload)?.reason)
        break

      case 'TAB_FORCE_SHUTDOWN':
        wsManager.forceShutdown((message.payload as ForceShutdownPayload)?.reason)
        break

      case 'TAB_NETWORK_ONLINE':
        wsManager.handleNetworkOnline()
        break

      default:
        console.warn('[SharedWorker] 未知消息类型', message.type)
    }
  }

  port.start()
}
