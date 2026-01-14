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

  /** Worker Blob URL（用于清理） */
  private workerBlobUrl: string | null = null

  /** 连接回调 */
  private onConnectedCallback: (() => void) | null = null

  /** 断开回调 */
  private onDisconnectedCallback: (() => void) | null = null

  /** 错误回调 */
  private onErrorCallback: ((error: ErrorPayload) => void) | null = null

  /** 身份冲突回调 */
  private onAuthConflictCallback: ((conflict: AuthConflictPayload) => void) | null = null

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
   * 启动 SharedWorker 连接
   */
  async start(): Promise<boolean> {
    try {
      this.logger.debug('[SharedWorkerManager] 开始启动 SharedWorker')

      // 创建 Worker Blob URL
      const workerScript = this.getWorkerScriptBlob()
      this.workerBlobUrl = URL.createObjectURL(workerScript)
      this.logger.debug(`[SharedWorkerManager] Worker Blob URL 创建成功: ${this.workerBlobUrl}`)

      // 创建 SharedWorker（使用 classic 模式，不是 module）
      this.logger.debug('[SharedWorkerManager] 正在创建 SharedWorker 实例...')
      this.worker = new SharedWorker(this.workerBlobUrl, {
        name: 'dj-common-websocket-worker',
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

      this.logger.info('[SharedWorkerManager] SharedWorker 已启动')
      return true
    } catch (error) {
      this.logger.error('[SharedWorkerManager] 启动 SharedWorker 失败', error)
      return false
    }
  }

  /**
   * 停止 SharedWorker 连接
   */
  stop(): void {
    this.logger.debug('[SharedWorkerManager] 停止 SharedWorker')

    // 发送断开消息
    if (this.port) {
      this.sendToWorker('TAB_DISCONNECT' as TabToWorkerMessageType, {})
    }

    // 移除可见性监听
    this.removeVisibilityListener()

    // 清理资源
    if (this.port) {
      this.port.close()
      this.port = null
    }

    if (this.workerBlobUrl) {
      URL.revokeObjectURL(this.workerBlobUrl)
      this.workerBlobUrl = null
    }

    this.worker = null
    this.connected = false
    this.callbacks.clear()
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
      const payload: VisibilityPayload = { isVisible }
      this.sendToWorker('TAB_VISIBILITY' as TabToWorkerMessageType, payload)
    }
  }

  /**
   * 获取 Worker 脚本 Blob
   */
  private getWorkerScriptBlob(): Blob {
    try {
      const workerCode = this.getWorkerScriptContent()
      this.logger.debug(`[SharedWorkerManager] 正在创建 Worker Blob, 代码长度: ${workerCode.length}`)

      const blob = new Blob([workerCode], { type: 'application/javascript' })
      this.logger.debug(`[SharedWorkerManager] ✅ Worker Blob 创建成功, size: ${blob.size}`)

      return blob
    } catch (error) {
      this.logger.error('[SharedWorkerManager] ❌ 创建 Worker Blob 失败:', error)
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
