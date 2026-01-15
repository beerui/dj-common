import { WebSocketClient, WebSocketConfig, MessageCallbackEntry, MessageCallback } from './WebSocketClient'
import { Logger, LogLevel } from './logger'
import { SharedWorkerManager } from './SharedWorkerManager'
import type { ConnectionMode } from './types'

/**
 * MessageSocket 配置选项
 */
export interface MessageSocketConfig extends WebSocketConfig {
  /** WebSocket 服务器地址，默认 '' */
  url?: string
  /** 消息回调列表 */
  callbacks?: MessageCallbackEntry[]
  /** 日志级别 */
  logLevel?: LogLevel
  /** 是否启用页面可见性管理（标签页切换时自动断开/重连），默认 false */
  enableVisibilityManagement?: boolean
  /** 连接模式，默认 'auto' */
  connectionMode?: ConnectionMode
  /** SharedWorker 空闲超时时间（毫秒），默认 30000 */
  sharedWorkerIdleTimeout?: number
  /** 启动时强制新建 SharedWorker（会生成新的 worker 会话名，并尝试关闭旧 worker），默认 false */
  forceNewWorkerOnStart?: boolean
}

/**
 * MessageSocket 启动选项
 */
export interface MessageSocketStartOptions {
  /** 用户ID（必需） */
  userId: string
  /** 认证令牌（必需） */
  token: string
}

/**
 * 消息 Socket 类
 * 基于 WebSocketClient，提供用户认证和消息管理功能
 * 用于获取用户未读消息数量等业务场景
 *
 * @example
 * ```typescript
 * // 启动连接
 * MessageSocket.start({
 *   userId: '1234567890',
 *   token: 'your-token',
 * })
 *
 * // 停止连接
 * MessageSocket.stop()
 *
 * // 设置配置
 * MessageSocket.setConfig({
 *   baseUrl: 'ws://your-server.com',
 *   path: '/your/path',
 * })
 *
 * // 初始化时设置回调
 * MessageSocket.setCallbacks([
 *   {
 *     type: 'UNREAD_COUNT',
 *     callback: (payload) => {
 *       console.log('未读消息数:', payload)
 *     }
 *   }
 * ])
 * // 动态注册回调
 * MessageSocket.registerCallbacks({
 *   type: 'NEW_MESSAGE',
 *   callback: (payload) => {
 *     console.log('新消息:', payload)
 *   }
 * })
 * ```
 * // logLevel 设置日志级别，默认 'warn'，可选 'debug', 'info', 'warn', 'error', 'silent'
 *
 */
export class MessageSocket {
  /** 默认配置 */
  private static readonly DEFAULT_CONFIG: Required<MessageSocketConfig> = {
    url: '', // WebSocket 服务器地址，默认 ''
    heartbeatInterval: 25000, // 心跳间隔，默认 25 秒
    maxReconnectAttempts: 10, // 最大重连次数，默认 10 次
    reconnectDelay: 3000, // 重连延迟，默认 3 秒
    reconnectDelayMax: 10000, // 最大重连延迟，默认 10 秒
    autoReconnect: true, // 是否自动重连，默认 true
    callbacks: [], // 初始消息回调列表，默认 []
    heartbeatMessage: () => ({
      type: 'PING',
      timestamp: Date.now(), // 心跳消息，默认 { type: 'PING', timestamp: Date.now() }
    }),
    logLevel: 'warn', // 日志级别，默认 'warn'
    enableVisibilityManagement: false, // 是否启用页面可见性管理，默认 false
    connectionMode: 'auto', // 连接模式，默认 'auto'
    sharedWorkerIdleTimeout: 30000, // SharedWorker 空闲超时时间，默认 30 秒
    forceNewWorkerOnStart: false, // 启动时强制重置 Worker 状态，默认 false（仅在需要强制刷新连接参数时使用）
  }

  /** WebSocket 客户端实例 */
  private static client: WebSocketClient | null = null

  /** SharedWorker 管理器实例 */
  private static workerManager: SharedWorkerManager | null = null

  /** 当前连接模式 */
  private static currentMode: 'sharedWorker' | 'visibility' | 'normal' = 'normal'

  private static readonly logger = new Logger('MessageSocket', MessageSocket.DEFAULT_CONFIG.logLevel)

  private static updateLoggerLevel(): void {
    MessageSocket.logger.setLevel(MessageSocket.config.logLevel ?? MessageSocket.DEFAULT_CONFIG.logLevel)
  }

  /** 当前用户ID */
  private static currentUserId: string | null = null

  /** 当前token */
  private static currentToken: string | null = null

  /** 当前配置 */
  private static config: MessageSocketConfig = { ...MessageSocket.DEFAULT_CONFIG }

  /** 是否已初始化页面可见性监听 */
  private static visibilityListenerInitialized = false

  /**
   * 页面可见性变化处理器
   * 当标签页不可见时断开连接，可见时重新连接
   */
  private static handleVisibilityChange = (): void => {
    if (typeof document === 'undefined') return

    const isVisible = !document.hidden

    if (!isVisible) {
      // 页面不可见时断开连接，避免多标签页重复连接
      MessageSocket.logger.info('[MessageSocket1111111111111111111111] 页面不可见，断开连接')
      if (MessageSocket.client) {
        MessageSocket.client.disconnect()
      }
    } else {
      // 页面可见时重新连接
      if (MessageSocket.currentUserId && MessageSocket.currentToken) {
        MessageSocket.logger.info('[MessageSocket1111111111111111111111] 页面可见，尝试重新连接')
        // 检查是否已经有活跃连接
        if (!MessageSocket.client || !MessageSocket.client.isConnected()) {
          MessageSocket.start({
            userId: MessageSocket.currentUserId,
            token: MessageSocket.currentToken,
          })
        }
      }
    }
  }

  /**
   * 初始化页面可见性监听
   */
  private static initVisibilityListener(): void {
    if (typeof document === 'undefined' || MessageSocket.visibilityListenerInitialized) {
      return
    }

    document.addEventListener('visibilitychange', MessageSocket.handleVisibilityChange)
    MessageSocket.visibilityListenerInitialized = true
    MessageSocket.logger.debug('[MessageSocket] 已初始化页面可见性监听')
  }

  /**
   * 移除页面可见性监听
   */
  private static removeVisibilityListener(): void {
    if (typeof document === 'undefined' || !MessageSocket.visibilityListenerInitialized) {
      return
    }

    document.removeEventListener('visibilitychange', MessageSocket.handleVisibilityChange)
    MessageSocket.visibilityListenerInitialized = false
    MessageSocket.logger.debug('[MessageSocket] 已移除页面可见性监听')
  }

  /**
   * 检测 SharedWorker 支持
   */
  private static detectSharedWorkerSupport(): boolean {
    return typeof SharedWorker !== 'undefined' && typeof Blob !== 'undefined'
  }

  /**
   * 检测 Visibility API 支持
   */
  private static detectVisibilitySupport(): boolean {
    return typeof document !== 'undefined' && typeof document.hidden !== 'undefined'
  }

  /**
   * 决定连接模式
   */
  private static determineConnectionMode(): 'sharedWorker' | 'visibility' | 'normal' {
    const mode = MessageSocket.config.connectionMode || 'auto'

    if (mode === 'auto') {
      // 自动选择最佳模式
      if (this.detectSharedWorkerSupport()) {
        MessageSocket.logger.info('[MessageSocket] 自动选择 SharedWorker 模式')
        return 'sharedWorker'
      }
      if (this.detectVisibilitySupport() && MessageSocket.config.enableVisibilityManagement) {
        MessageSocket.logger.info('[MessageSocket] 自动选择 Visibility 模式')
        return 'visibility'
      }
      MessageSocket.logger.info('[MessageSocket] 自动选择 Normal 模式')
      return 'normal'
    }

    if (mode === 'sharedWorker') {
      if (this.detectSharedWorkerSupport()) {
        MessageSocket.logger.info('[MessageSocket] 使用 SharedWorker 模式')
        return 'sharedWorker'
      }
      // 降级
      MessageSocket.logger.warn('[MessageSocket] 浏览器不支持 SharedWorker，降级到 Visibility 模式')
      if (this.detectVisibilitySupport() && MessageSocket.config.enableVisibilityManagement) {
        return 'visibility'
      }
      MessageSocket.logger.warn('[MessageSocket] 降级到 Normal 模式')
      return 'normal'
    }

    if (mode === 'visibility') {
      if (this.detectVisibilitySupport()) {
        MessageSocket.logger.info('[MessageSocket] 使用 Visibility 模式')
        return 'visibility'
      }
      MessageSocket.logger.warn('[MessageSocket] 浏览器不支持 Visibility API，降级到 Normal 模式')
      return 'normal'
    }

    // normal 模式
    MessageSocket.logger.info('[MessageSocket] 使用 Normal 模式')
    return 'normal'
  }

  /**
   * 配置 MessageSocket
   * @param config 配置选项
   */
  public static configure(config: Partial<MessageSocketConfig>): void {
    MessageSocket.config = { ...MessageSocket.config, ...config }
  }

  /**
   * 设置配置
   * @param config 配置选项
   * @returns MessageSocket
   */
  public static setConfig(config: Partial<MessageSocketConfig>): typeof MessageSocket {
    MessageSocket.config = { ...MessageSocket.config, ...config }
    MessageSocket.updateLoggerLevel()
    if (MessageSocket.config.callbacks && MessageSocket.config.callbacks.length > 0) {
      MessageSocket.setCallbacks(MessageSocket.config.callbacks)
    }
    return MessageSocket
  }

  /**
   * 设置回调
   * @param callbacks 回调列表
   * @returns MessageSocket
   */
  public static setCallbacks(callbacks: MessageCallbackEntry[]): typeof MessageSocket {
    if (!callbacks || callbacks.length === 0) {
      this.logger.warn('[MessageSocket] 回调列表为空，无法设置回调')
      return MessageSocket
    }

    MessageSocket.config.callbacks = callbacks
    return MessageSocket
  }

  /**
   * 启动连接
   * @param options 启动选项
   * 回调在开始的时候注册，这种能
   */
  public static start(options: MessageSocketStartOptions): void {
    if (!MessageSocket.config.url) {
      this.logger.error('[MessageSocket] 缺少配置 url, 请先调用 setConfig 设置配置!')
      return
    }

    const { userId, token } = options

    if (!userId || !token) {
      this.logger.error('[MessageSocket] 缺少 userId 或 token，无法启动')
      return
    }

    this.logger.info('[MessageSocket] 开始连接', userId)

    // 决定连接模式
    MessageSocket.currentMode = MessageSocket.determineConnectionMode()

    // 根据模式启动
    if (MessageSocket.currentMode === 'sharedWorker') {
      MessageSocket.startWithSharedWorker(options)
    } else if (MessageSocket.currentMode === 'visibility') {
      MessageSocket.startWithVisibility(options)
    } else {
      MessageSocket.startWithNormalMode(options)
    }
  }

  /**
   * 使用 SharedWorker 模式启动
   */
  private static async startWithSharedWorker(options: MessageSocketStartOptions): Promise<void> {
    const { userId, token } = options

    // 停止旧连接
    MessageSocket.stop()

    // 保存当前用户信息
    MessageSocket.currentUserId = userId
    MessageSocket.currentToken = token

    // 创建 SharedWorker 管理器
    MessageSocket.workerManager = new SharedWorkerManager({
      url: MessageSocket.config.url!,
      userId,
      token,
      isVisible: typeof document !== 'undefined' ? !document.hidden : true,
      config: MessageSocket.config,
      sharedWorkerIdleTimeout: MessageSocket.config.sharedWorkerIdleTimeout,
      logLevel: MessageSocket.config.logLevel,
      forceNewWorkerOnStart: MessageSocket.config.forceNewWorkerOnStart,
    })

    // 设置错误回调（降级）
    MessageSocket.workerManager.onError((error) => {
      MessageSocket.logger.warn('[MessageSocket] SharedWorker 失败，降级到 Visibility 模式', error)
      MessageSocket.currentMode = 'visibility'
      MessageSocket.workerManager = null
      MessageSocket.startWithVisibility(options)
    })

    // 启动 Worker（必须先启动，创建 port 后才能注册回调）
    const success = await MessageSocket.workerManager.start()

    if (!success) {
      // 降级
      MessageSocket.logger.warn('[MessageSocket] SharedWorker 启动失败，降级到 Visibility 模式')
      MessageSocket.currentMode = 'visibility'
      MessageSocket.workerManager = null
      MessageSocket.startWithVisibility(options)
      return
    }

    // 注册已有的回调（必须在 start() 之后，此时 port 已创建）
    if (MessageSocket.config.callbacks && MessageSocket.config.callbacks.length > 0) {
      MessageSocket.config.callbacks.forEach((entry) => {
        MessageSocket.workerManager!.registerCallback(entry)
      })
    }
  }

  /**
   * 使用 Visibility 模式启动
   */
  private static startWithVisibility(options: MessageSocketStartOptions): void {
    const { userId, token } = options

    // 检查是否可以复用现有连接
    const shouldReuse =
      MessageSocket.client &&
      MessageSocket.client.isConnected() &&
      MessageSocket.currentUserId === userId &&
      MessageSocket.currentToken === token

    if (shouldReuse) {
      this.logger.debug('[MessageSocket] 复用现有连接')
      return
    }

    // 停止旧连接
    MessageSocket.stop()

    // 保存当前用户信息
    MessageSocket.currentUserId = userId
    MessageSocket.currentToken = token

    // 构建 WebSocket URL
    const { url, ...clientConfig } = MessageSocket.config
    const targetUrl = `${url}/${userId}?token=${encodeURIComponent(token)}`

    // 创建新的 WebSocket 客户端
    MessageSocket.client = new WebSocketClient({
      ...clientConfig,
      url: targetUrl,
    })

    // 注册回调（直接注册到 client，不经过 registerCallbacks）
    if (MessageSocket.config.callbacks && MessageSocket.config.callbacks.length > 0) {
      MessageSocket.config.callbacks.forEach((entry) => MessageSocket.client!.on(entry))
    }

    // 初始化页面可见性监听
    MessageSocket.initVisibilityListener()

    // 连接
    MessageSocket.client.connect()
  }

  /**
   * 使用 Normal 模式启动
   */
  private static startWithNormalMode(options: MessageSocketStartOptions): void {
    const { userId, token } = options

    // 检查是否可以复用现有连接
    const shouldReuse =
      MessageSocket.client &&
      MessageSocket.client.isConnected() &&
      MessageSocket.currentUserId === userId &&
      MessageSocket.currentToken === token

    if (shouldReuse) {
      this.logger.debug('[MessageSocket] 复用现有连接')
      return
    }

    // 停止旧连接
    MessageSocket.stop()

    // 保存当前用户信息
    MessageSocket.currentUserId = userId
    MessageSocket.currentToken = token

    // 构建 WebSocket URL
    const { url, ...clientConfig } = MessageSocket.config
    const targetUrl = `${url}/${userId}?token=${encodeURIComponent(token)}`

    // 创建新的 WebSocket 客户端
    MessageSocket.client = new WebSocketClient({
      ...clientConfig,
      url: targetUrl,
    })

    // 注册回调（直接注册到 client，不经过 registerCallbacks）
    if (MessageSocket.config.callbacks && MessageSocket.config.callbacks.length > 0) {
      MessageSocket.config.callbacks.forEach((entry) => MessageSocket.client!.on(entry))
    }

    // 连接
    MessageSocket.client.connect()
  }

  /**
   * 停止连接
   */
  public static stop(): void {
    MessageSocket.logger.info('[MessageSocket] 停止连接')
    if (MessageSocket.client) {
      MessageSocket.client.disconnect()
      MessageSocket.client.clearCallbacks()
      MessageSocket.client = null
    }

    if (MessageSocket.workerManager) {
      MessageSocket.workerManager.stop()
      MessageSocket.workerManager = null
    }

    // 清理页面可见性监听
    MessageSocket.removeVisibilityListener()

    MessageSocket.currentUserId = null
    MessageSocket.currentToken = null
  }

  /**
   * 注册消息回调
   * @param entry 回调配置
   */
  public static registerCallbacks<T = unknown>(entry: MessageCallbackEntry<T>): void {
    if (!entry) {
      this.logger.warn('[MessageSocket] 注册回调失败，缺少 entry', entry)
      return
    }

    if (typeof entry !== 'object') {
      this.logger.warn('[MessageSocket] 注册回调失败，entry 不是对象', entry)
      return
    }

    if (typeof entry.callback !== 'function') {
      this.logger.warn('[MessageSocket] 注册回调失败，callback 不是函数', entry)
      return
    }

    if (typeof entry.type !== 'string') {
      this.logger.warn('[MessageSocket] 注册回调失败，type 不是字符串', entry)
      return
    }

    // 根据当前模式注册回调
    if (MessageSocket.currentMode === 'sharedWorker' && MessageSocket.workerManager) {
      MessageSocket.workerManager.registerCallback(entry)
    } else if (MessageSocket.client) {
      MessageSocket.client.on(entry)
    } else {
      this.logger.warn('[MessageSocket] 无可用连接，无法注册回调')
    }
  }

  /**
   * 取消注册消息回调
   * @param type 消息类型
   * @param callback 回调函数（可选）
   */
  public static unregisterCallbacks<T = unknown>(type: string, callback?: (data: T, message?: unknown) => void): void {
    // 根据当前模式取消注册
    if (MessageSocket.currentMode === 'sharedWorker' && MessageSocket.workerManager) {
      MessageSocket.workerManager.unregisterCallback(type, callback as MessageCallback)
    } else if (MessageSocket.client) {
      MessageSocket.client.off(type, callback)
    }
  }

  /**
   * 发送消息
   * @param data 消息数据
   */
  public static send(data: string | object): void {
    // 根据当前模式发送
    if (MessageSocket.currentMode === 'sharedWorker' && MessageSocket.workerManager) {
      MessageSocket.workerManager.send(data)
    } else if (MessageSocket.client) {
      MessageSocket.client.send(data)
    } else {
      this.logger.warn('[MessageSocket] 无可用连接，无法发送消息')
    }
  }

  /**
   * 获取连接状态
   */
  public static getReadyState(): number {
    return MessageSocket.client?.getReadyState() ?? WebSocket.CLOSED
  }

  /**
   * 是否已连接
   */
  public static isConnected(): boolean {
    if (MessageSocket.currentMode === 'sharedWorker' && MessageSocket.workerManager) {
      return MessageSocket.workerManager.isConnected()
    }
    return MessageSocket.client?.isConnected() ?? false
  }

  /**
   * 获取当前连接模式
   */
  public static getConnectionMode(): 'sharedWorker' | 'visibility' | 'normal' {
    return MessageSocket.currentMode
  }

  /**
   * 获取当前用户ID
   */
  public static getCurrentUserId(): string | null {
    return MessageSocket.currentUserId
  }

  /**
   * 获取当前token
   */
  public static getCurrentToken(): string | null {
    return MessageSocket.currentToken
  }
}
