/**
 * SharedWorker 管理器（标签页端）
 * 负责在标签页中创建和管理 SharedWorker 连接
 */

import { Logger, LogLevel } from './logger'
import type { MessageCallback, MessageCallbackEntry } from './WebSocketClient'
import type {
  TabToWorkerMessage,
  WorkerToTabMessage,
  TabToWorkerMessageType,
  WorkerToTabMessageType,
  InitPayload,
  SendPayload,
  VisibilityPayload,
  RegisterCallbackPayload,
  UnregisterCallbackPayload,
  ServerMessagePayload,
  ErrorPayload,
  AuthConflictPayload,
} from './types'

/**
 * SharedWorker 管理器配置
 */
export interface SharedWorkerManagerConfig extends InitPayload {
  /** 日志级别 */
  logLevel?: LogLevel
  /** 启动时强制新建 SharedWorker（会生成新的 worker 会话名，并尝试关闭旧 worker） */
  forceNewWorkerOnStart?: boolean
}

/**
 * 回调条目（带 ID）
 */
interface CallbackEntryWithId<T = unknown> extends MessageCallbackEntry<T> {
  /** 回调ID */
  id: string
}

/**
 * SharedWorker 管理器类
 */
export class SharedWorkerManager {
  private static readonly WORKER_NAME = 'dj-common-websocket-worker'

  /** SharedWorker 实例 */
  private worker: SharedWorker | null = null

  /** MessagePort 实例 */
  private port: MessagePort | null = null

  /** 标签页ID */
  private readonly tabId: string

  /** 回调列表 */
  private callbacks: Map<string, CallbackEntryWithId> = new Map()

  /** 回调ID计数器 */
  private callbackIdCounter = 0

  /** 是否已连接 */
  private connected = false

  /** 是否已初始化可见性监听 */
  private visibilityListenerInitialized = false

  /** 配置 */
  private config: SharedWorkerManagerConfig

  /** 日志器 */
  private readonly logger: Logger

  /** 连接回调 */
  private onConnectedCallback: (() => void) | null = null

  /** 断开回调 */
  private onDisconnectedCallback: (() => void) | null = null

  /** 错误回调 */
  private onErrorCallback: ((error: ErrorPayload) => void) | null = null

  /** 身份冲突回调 */
  private onAuthConflictCallback: ((conflict: AuthConflictPayload) => void) | null = null

  /** 标签页心跳定时器（用于让 Worker 能识别已关闭标签页） */
  private pingTimer: ReturnType<typeof globalThis.setInterval> | null = null

  /** 是否已初始化卸载监听 */
  private unloadListenerInitialized = false

  /** 是否已初始化网络状态监听 */
  private networkListenerInitialized = false

  /**
   * 构造函数
   */
  constructor(config: SharedWorkerManagerConfig) {
    this.config = config
    this.tabId = this.generateTabId()
    this.logger = new Logger('SharedWorkerManager', config.logLevel ?? 'warn')
  }

  /**
   * 生成标签页ID
   */
  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 发送重置命令到现有 Worker（断开 WebSocket 并清理状态，但不终止 Worker）
   */
  private async sendResetToExistingWorker(workerScriptUrl: string): Promise<void> {
    try {
      // 连接到现有的 SharedWorker
      const existing = new SharedWorker(workerScriptUrl, { name: SharedWorkerManager.WORKER_NAME })
      const port = existing.port
      port.start()
      port.postMessage({
        type: 'TAB_FORCE_RESET' as TabToWorkerMessageType,
        payload: { reason: 'force_new_start' },
        tabId: this.tabId,
        timestamp: Date.now(),
      } satisfies TabToWorkerMessage)
      // 等待消息发送完成后再关闭 port
      await new Promise((resolve) => setTimeout(resolve, 100))
      port.close()
      this.logger.debug('[SharedWorkerManager] 已发送重置命令到现有 Worker')
    } catch (error) {
      this.logger.warn('[SharedWorkerManager] 发送重置命令失败（可忽略）', error)
    }
  }

  /**
   * 启动 SharedWorker 连接
   */
  async start(): Promise<boolean> {
    try {
      this.logger.debug('[SharedWorkerManager] 开始启动 SharedWorker')

      // 创建 Worker 脚本 URL（必须跨标签页一致，否则 SharedWorker 无法复用）
      // 注意：Blob URL 每次都会不同，因此不能用于 SharedWorker 复用。
      const workerScriptUrl = this.getWorkerScriptDataUrl()
      this.logger.debug(`[SharedWorkerManager] Worker Script URL 创建成功: ${workerScriptUrl.slice(0, 60)}...`)

      // 若要求强制重置，则先发送重置命令让 Worker 断开 WebSocket 并清理状态
      if (this.config.forceNewWorkerOnStart) {
        this.logger.debug('[SharedWorkerManager] forceNewWorkerOnStart=true，发送重置命令')
        await this.sendResetToExistingWorker(workerScriptUrl)
      }

      // 创建 SharedWorker（使用固定的 name，所有标签页共享同一个 Worker）
      this.logger.debug('[SharedWorkerManager] 正在创建 SharedWorker 实例...')
      this.worker = new SharedWorker(workerScriptUrl, {
        name: SharedWorkerManager.WORKER_NAME,
        // 注意：不使用 type: 'module'，因为 Blob URL 作为 module 有 CORS 限制
      })
      this.logger.debug('[SharedWorkerManager] ✅ SharedWorker 实例创建成功')

      this.port = this.worker.port
      this.port.onmessage = this.handleWorkerMessage.bind(this)
      // MessagePort 没有 onerror，错误会在 worker 中抛出
      this.port.start()
      this.logger.debug('[SharedWorkerManager] ✅ MessagePort 已启动')

      // 设置页面可见性监听
      this.setupVisibilityListener()

      // 设置页面卸载监听（页面关闭/刷新时通知 Worker 及时移除 tab）
      this.setupUnloadListener()

      // 设置网络状态监听（网络恢复时通知 Worker 重连）
      this.setupNetworkListener()

      // 发送初始化消息（只发送可序列化的配置项）
      const serializableConfig = {
        heartbeatInterval: this.config.config.heartbeatInterval,
        maxReconnectAttempts: this.config.config.maxReconnectAttempts,
        reconnectDelay: this.config.config.reconnectDelay,
        reconnectDelayMax: this.config.config.reconnectDelayMax,
        autoReconnect: this.config.config.autoReconnect,
        logLevel: this.config.config.logLevel,
      }

      this.sendToWorker(
        'TAB_INIT' as TabToWorkerMessageType,
        {
          url: this.config.url,
          userId: this.config.userId,
          token: this.config.token,
          isVisible: !document.hidden,
          config: serializableConfig,
          sharedWorkerIdleTimeout: this.config.sharedWorkerIdleTimeout,
        } as InitPayload
      )

      // 启动与 Worker 的轻量心跳（用于 Worker 回收已关闭标签页）
      this.startPing()

      this.logger.info('[SharedWorkerManager] SharedWorker 已启动')
      return true
    } catch (error) {
      this.logger.error('[SharedWorkerManager] 启动 SharedWorker 失败', error)
      return false
    }
  }

  /**
   * 停止 SharedWorker 连接（只断开当前标签页，不影响其他标签页）
   */
  stop(): void {
    this.logger.debug('[SharedWorkerManager] 停止当前标签页的 SharedWorker 连接')

    // 保存 port 引用，用于延迟关闭
    const portToClose = this.port

    // 发送断开消息，告知 Worker 移除当前标签页
    if (this.port) {
      this.sendToWorker('TAB_DISCONNECT' as TabToWorkerMessageType, {})
    }

    // 停止心跳
    this.stopPing()

    // 移除可见性监听
    this.removeVisibilityListener()

    // 移除卸载监听
    this.removeUnloadListener()

    // 移除网络状态监听
    this.removeNetworkListener()

    // 清理引用（但延迟关闭 port，确保消息发送完成）
    this.port = null
    this.worker = null
    this.connected = false
    this.callbacks.clear()

    // 延迟关闭 port，确保 postMessage 消息被发送出去
    if (portToClose) {
      setTimeout(() => {
        try {
          portToClose.close()
        } catch {
          // 忽略关闭错误
        }
      }, 100)
    }
  }

  /**
   * 强制关闭 Worker（会影响所有标签页，用于退出登录）
   */
  forceShutdown(): void {
    this.logger.debug('[SharedWorkerManager] 强制关闭 Worker（退出登录）')

    // 保存 port 引用，用于延迟关闭
    const portToClose = this.port

    // 发送强制关闭命令
    if (this.port) {
      this.sendToWorker('TAB_FORCE_SHUTDOWN' as TabToWorkerMessageType, {
        reason: 'logout',
      })
    }

    // 停止心跳
    this.stopPing()

    // 移除可见性监听
    this.removeVisibilityListener()

    // 移除卸载监听
    this.removeUnloadListener()

    // 移除网络状态监听
    this.removeNetworkListener()

    // 清理引用
    this.port = null
    this.worker = null
    this.connected = false
    this.callbacks.clear()

    // 延迟关闭 port
    if (portToClose) {
      setTimeout(() => {
        try {
          portToClose.close()
        } catch {
          // 忽略关闭错误
        }
      }, 100)
    }
  }

  /**
   * 发送消息到服务器
   */
  send(data: string | object): void {
    if (!this.port) {
      this.logger.warn('[SharedWorkerManager] MessagePort 未初始化，无法发送消息')
      return
    }

    const payload: SendPayload = { data }
    this.sendToWorker('TAB_SEND' as TabToWorkerMessageType, payload)
  }

  /**
   * 注册消息回调
   */
  registerCallback<T = unknown>(entry: MessageCallbackEntry<T>): string {
    const callbackId = `callback_${this.callbackIdCounter++}`
    const entryWithId: CallbackEntryWithId<T> = {
      ...entry,
      id: callbackId,
    }

    this.callbacks.set(callbackId, entryWithId as CallbackEntryWithId)

    // 通知 Worker
    if (this.port) {
      const payload: RegisterCallbackPayload = {
        type: entry.type,
        callbackId,
        skipHistoryMessage: entry.skipHistoryMessage,
      }
      this.sendToWorker('TAB_REGISTER_CALLBACK' as TabToWorkerMessageType, payload)
      this.logger.debug(`[SharedWorkerManager] ✅ 已发送注册消息到 Worker: ${entry.type} (${callbackId})`)
    } else {
      this.logger.warn(`[SharedWorkerManager] ⚠️ port 未初始化，无法发送注册消息: ${entry.type}`)
    }

    this.logger.debug(
      `[SharedWorkerManager] 注册回调: ${entry.type} (${callbackId}), 当前回调总数: ${this.callbacks.size}`
    )
    return callbackId
  }

  /**
   * 取消注册消息回调
   */
  unregisterCallback(type: string, callback?: MessageCallback): void {
    if (callback) {
      // 移除特定回调
      let callbackId: string | null = null

      for (const [id, entry] of this.callbacks.entries()) {
        if (entry.type === type && entry.callback === callback) {
          callbackId = id
          this.callbacks.delete(id)
          break
        }
      }

      if (callbackId && this.port) {
        const payload: UnregisterCallbackPayload = {
          type,
          callbackId,
        }
        this.sendToWorker('TAB_UNREGISTER_CALLBACK' as TabToWorkerMessageType, payload)
      }

      this.logger.debug(`[SharedWorkerManager] 取消注册回调: ${type} (${callbackId})`)
    } else {
      // 移除该类型的所有回调
      const callbackIds: string[] = []

      for (const [id, entry] of this.callbacks.entries()) {
        if (entry.type === type) {
          callbackIds.push(id)
          this.callbacks.delete(id)
        }
      }

      if (this.port) {
        const payload: UnregisterCallbackPayload = { type }
        this.sendToWorker('TAB_UNREGISTER_CALLBACK' as TabToWorkerMessageType, payload)
      }

      this.logger.debug(`[SharedWorkerManager] 取消注册所有 ${type} 类型回调 (${callbackIds.length} 个)`)
    }
  }

  /**
   * 清空所有回调
   */
  clearCallbacks(): void {
    for (const entry of this.callbacks.values()) {
      if (this.port) {
        const payload: UnregisterCallbackPayload = {
          type: entry.type,
          callbackId: entry.id,
        }
        this.sendToWorker('TAB_UNREGISTER_CALLBACK' as TabToWorkerMessageType, payload)
      }
    }

    this.callbacks.clear()
    this.logger.debug('[SharedWorkerManager] 已清空所有回调')
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * 设置连接回调
   */
  onConnected(callback: () => void): void {
    this.onConnectedCallback = callback
  }

  /**
   * 设置断开回调
   */
  onDisconnected(callback: () => void): void {
    this.onDisconnectedCallback = callback
  }

  /**
   * 设置错误回调
   */
  onError(callback: (error: ErrorPayload) => void): void {
    this.onErrorCallback = callback
  }

  /**
   * 设置身份冲突回调
   */
  onAuthConflict(callback: (conflict: AuthConflictPayload) => void): void {
    this.onAuthConflictCallback = callback
  }

  /**
   * 处理来自 Worker 的消息
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const message = event.data as WorkerToTabMessage

    this.logger.debug(`[SharedWorkerManager] 📬 收到 Worker 消息, type: ${message.type}`)

    switch (message.type) {
      case 'WORKER_CONNECTED' as WorkerToTabMessageType:
        this.connected = true
        this.logger.info('[SharedWorkerManager] ✅ WebSocket 已连接')
        this.onConnectedCallback?.()
        break

      case 'WORKER_DISCONNECTED' as WorkerToTabMessageType:
        this.connected = false
        this.logger.info('[SharedWorkerManager] WebSocket 已断开')
        this.onDisconnectedCallback?.()
        break

      case 'WORKER_MESSAGE' as WorkerToTabMessageType:
        // 始终打印每一条来自 Worker 的服务器消息，便于排查“回调未注册/未匹配”导致页面无回显的问题
        try {
          const payload = message.payload as ServerMessagePayload
          // 用 console.log 确保即使 logLevel 较高也能看到

          this.logger.info('[SharedWorkerManager] 📨 收到服务器消息（经 Worker 转发）', payload?.message)
          this.logger.debug('[SharedWorkerManager] 🧾 原始消息 data:', payload?.data)
        } catch (error) {
          this.logger.warn('[SharedWorkerManager] 打印服务器消息失败', error)
        }

        this.handleServerMessage(message.payload as ServerMessagePayload)
        break

      case 'WORKER_ERROR' as WorkerToTabMessageType:
        this.logger.error('[SharedWorkerManager] Worker 错误', message.payload)
        this.onErrorCallback?.(message.payload as ErrorPayload)
        break

      case 'WORKER_AUTH_CONFLICT' as WorkerToTabMessageType:
        this.logger.warn('[SharedWorkerManager] 身份冲突', message.payload)
        this.onAuthConflictCallback?.(message.payload as AuthConflictPayload)
        break

      case 'WORKER_PONG' as WorkerToTabMessageType:
        this.logger.debug('[SharedWorkerManager] 收到 PONG')
        break

      case 'WORKER_TAB_NOT_FOUND' as WorkerToTabMessageType:
        this.logger.warn('[SharedWorkerManager] Worker 通知标签页不存在，需要重新初始化')
        this.reinitialize()
        break

      default:
        this.logger.warn('[SharedWorkerManager] 未知消息类型', message.type)
    }
  }

  /**
   * 处理服务器消息
   */
  private handleServerMessage(payload: ServerMessagePayload): void {
    const { message } = payload

    this.logger.debug(`[SharedWorkerManager] 📨 收到服务器消息, type: ${message.type}`)
    this.logger.debug(
      `[SharedWorkerManager] 当前注册的回调类型:`,
      Array.from(this.callbacks.values()).map((e) => e.type)
    )

    // 触发匹配的回调
    let matchedCount = 0
    for (const entry of this.callbacks.values()) {
      if (entry.type === message.type) {
        matchedCount++
        this.logger.debug(`[SharedWorkerManager] ✅ 匹配到回调 ${entry.type} (${entry.id})，准备执行`)
        try {
          entry.callback(message.data, message)
          this.logger.debug(`[SharedWorkerManager] ✅ 回调执行成功 ${entry.type} (${entry.id})`)
        } catch (error) {
          this.logger.error('[SharedWorkerManager] ❌ 回调执行失败', error)
        }
      }
    }

    if (matchedCount === 0) {
      this.logger.warn(`[SharedWorkerManager] ⚠️ 没有匹配的回调: ${message.type}`)
    }
  }

  /**
   * 发送消息到 Worker
   */
  private sendToWorker(type: TabToWorkerMessageType, payload: unknown): void {
    if (!this.port) {
      this.logger.warn('[SharedWorkerManager] MessagePort 未初始化，无法发送消息')
      return
    }

    const message: TabToWorkerMessage = {
      type,
      payload,
      tabId: this.tabId,
      timestamp: Date.now(),
    }

    try {
      this.port.postMessage(message)
    } catch (error) {
      this.logger.error('[SharedWorkerManager] 发送消息到 Worker 失败', error)
    }
  }

  /**
   * 设置页面可见性监听
   */
  private setupVisibilityListener(): void {
    if (typeof document === 'undefined' || this.visibilityListenerInitialized) {
      return
    }

    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    this.visibilityListenerInitialized = true
    this.logger.debug('[SharedWorkerManager] 已设置页面可见性监听')
  }

  /**
   * 移除页面可见性监听
   */
  private removeVisibilityListener(): void {
    if (typeof document === 'undefined' || !this.visibilityListenerInitialized) {
      return
    }

    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.visibilityListenerInitialized = false
    this.logger.debug('[SharedWorkerManager] 已移除页面可见性监听')
  }

  /**
   * 处理页面可见性变化
   */
  private handleVisibilityChange = (): void => {
    const isVisible = !document.hidden
    this.logger.debug(`[SharedWorkerManager] 页面可见性变化: ${isVisible}`)

    if (this.port) {
      // 如果页面变为可见且当前未连接，重新发送 TAB_INIT 重新初始化
      // 这处理了空闲超时后标签页被移除，用户再次切换回来的情况
      if (isVisible && !this.connected) {
        this.logger.info('[SharedWorkerManager] 页面变为可见且未连接，重新初始化连接')
        this.reinitialize()
      } else {
        const payload: VisibilityPayload = { isVisible }
        this.sendToWorker('TAB_VISIBILITY' as TabToWorkerMessageType, payload)
      }
    }
  }

  /**
   * 重新初始化连接（发送 TAB_INIT 消息）
   * 用于页面从不可见变为可见且连接已断开的情况
   */
  private reinitialize(): void {
    if (!this.port) {
      this.logger.warn('[SharedWorkerManager] 无法重新初始化：port 未初始化')
      return
    }

    const serializableConfig = {
      heartbeatInterval: this.config.config.heartbeatInterval,
      maxReconnectAttempts: this.config.config.maxReconnectAttempts,
      reconnectDelay: this.config.config.reconnectDelay,
      reconnectDelayMax: this.config.config.reconnectDelayMax,
      autoReconnect: this.config.config.autoReconnect,
      logLevel: this.config.config.logLevel,
    }

    this.sendToWorker(
      'TAB_INIT' as TabToWorkerMessageType,
      {
        url: this.config.url,
        userId: this.config.userId,
        token: this.config.token,
        isVisible: true,
        config: serializableConfig,
        sharedWorkerIdleTimeout: this.config.sharedWorkerIdleTimeout,
      } as InitPayload
    )

    // 重新注册所有回调
    for (const entry of this.callbacks.values()) {
      const payload: RegisterCallbackPayload = {
        type: entry.type,
        callbackId: entry.id,
      }
      this.sendToWorker('TAB_REGISTER_CALLBACK' as TabToWorkerMessageType, payload)
      this.logger.debug(`[SharedWorkerManager] 重新注册回调: ${entry.type} (${entry.id})`)
    }

    this.logger.info('[SharedWorkerManager] 已发送重新初始化消息')
  }

  /**
   * 启动与 Worker 的轻量心跳
   * 目的：当标签页被强制关闭/崩溃时，Worker 可通过超时回收该 tab
   */
  private startPing(): void {
    this.stopPing()
    if (typeof window === 'undefined' || !this.port) return

    // 10s 一次足够，开销很小
    this.pingTimer = globalThis.setInterval(() => {
      if (!this.port) return
      this.sendToWorker('TAB_PING' as TabToWorkerMessageType, {})
    }, 10000)
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  /**
   * 设置页面卸载监听（pagehide/beforeunload）
   */
  private setupUnloadListener(): void {
    if (typeof window === 'undefined' || this.unloadListenerInitialized) return

    window.addEventListener('pagehide', this.handlePageHide, { capture: true })
    window.addEventListener('beforeunload', this.handlePageHide, { capture: true })
    this.unloadListenerInitialized = true
    this.logger.debug('[SharedWorkerManager] 已设置页面卸载监听')
  }

  private removeUnloadListener(): void {
    if (typeof window === 'undefined' || !this.unloadListenerInitialized) return
    window.removeEventListener('pagehide', this.handlePageHide, { capture: true } as unknown as boolean)
    window.removeEventListener('beforeunload', this.handlePageHide, { capture: true } as unknown as boolean)
    this.unloadListenerInitialized = false
    this.logger.debug('[SharedWorkerManager] 已移除页面卸载监听')
  }

  private handlePageHide = (): void => {
    // 尽量在页面销毁前通知 Worker 移除 tab
    if (this.port) {
      this.sendToWorker('TAB_DISCONNECT' as TabToWorkerMessageType, {})
    }
  }

  // ========== 网络状态监听 ==========

  /**
   * 设置网络状态监听
   */
  private setupNetworkListener(): void {
    if (typeof window === 'undefined' || this.networkListenerInitialized) return

    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
    this.networkListenerInitialized = true
    this.logger.debug('[SharedWorkerManager] 已设置网络状态监听')
  }

  /**
   * 移除网络状态监听
   */
  private removeNetworkListener(): void {
    if (typeof window === 'undefined' || !this.networkListenerInitialized) return

    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
    this.networkListenerInitialized = false
    this.logger.debug('[SharedWorkerManager] 已移除网络状态监听')
  }

  /**
   * 网络恢复时的处理函数
   */
  private handleOnline = (): void => {
    this.logger.info('[SharedWorkerManager] 网络已恢复，通知 Worker 重连')

    // 通知 Worker 网络已恢复，应该重试连接
    if (this.port) {
      this.sendToWorker('TAB_NETWORK_ONLINE' as TabToWorkerMessageType, {})
    }
  }

  /**
   * 网络断开时的处理函数
   */
  private handleOffline = (): void => {
    this.logger.info('[SharedWorkerManager] 网络已断开')
    // Worker 会自动处理连接断开，这里只记录日志
  }

  /**
   * 获取 Worker 脚本 Data URL
   * 说明：SharedWorker 的复用依据是「脚本 URL + name」，所以必须让不同标签页拿到完全一致的脚本 URL。
   */
  private getWorkerScriptDataUrl(): string {
    const workerCode = this.getWorkerScriptContent()
    this.logger.debug(`[SharedWorkerManager] 正在创建 Worker Data URL, 代码长度: ${workerCode.length}`)

    // 兼容中文日志：必须做 UTF-8 base64
    const base64 = this.toBase64Utf8(workerCode)
    return `data:application/javascript;charset=utf-8;base64,${base64}`
  }

  /**
   * UTF-8 Base64 编码（避免 btoa 处理非 latin1 时报错）
   */
  private toBase64Utf8(input: string): string {
    try {
      if (typeof TextEncoder !== 'undefined') {
        const bytes = new TextEncoder().encode(input)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        // eslint-disable-next-line no-undef
        return btoa(binary)
      }
      // 兜底：老浏览器
      // eslint-disable-next-line no-undef
      return btoa(unescape(encodeURIComponent(input)))
    } catch (error) {
      this.logger.error('[SharedWorkerManager] ❌ Worker 脚本 base64 编码失败', error)
      throw error
    }
  }

  /**
   * 获取 Worker 脚本内容
   * 这里使用占位符，在构建时会被替换为实际的 Worker 代码
   */
  private getWorkerScriptContent(): string {
    // 占位符，构建时会被替换
    const content: string = '__WORKER_SCRIPT_CONTENT__'

    // 调试：检查内容是否被替换
    if (content === '__WORKER_SCRIPT_CONTENT__') {
      this.logger.error('[SharedWorkerManager] ❌ Worker 代码未被内联！构建配置有问题')
      throw new Error('Worker script not inlined during build')
    }

    this.logger.debug(`[SharedWorkerManager] Worker 脚本长度: ${content.length} 字符`)
    return content
  }
}
