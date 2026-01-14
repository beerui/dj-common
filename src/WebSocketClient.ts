import { Logger, LogLevel } from './logger'

/**
 * WebSocket 配置选项
 */
export interface WebSocketConfig {
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
  /** 日志输出等级 */
  logLevel?: LogLevel
}

/**
 * 消息数据结构
 */
export interface MessageData<T = unknown> {
  /** 消息类型 */
  type: string
  /** 消息数据 */
  data: T
  /** 元数据 */
  meta?: Record<string, unknown>
  /** 时间戳 */
  timestamp?: number
}

/**
 * 消息回调函数
 */
export type MessageCallback<T = unknown> = (data: T, message?: MessageData<T>) => void

/**
 * 消息回调配置
 */
export interface MessageCallbackEntry<T = unknown> {
  /** 消息类型 */
  type: string
  /** 回调函数 */
  callback: MessageCallback<T>
}

/**
 * WebSocket 基础封装类
 * 提供连接管理、心跳、自动重连、消息回调等基础功能
 */
export class WebSocketClient {
  /** WebSocket 连接实例 */
  protected socket: WebSocket | null = null

  /** 心跳定时器 */
  protected heartbeatTimer: number | null = null

  /** 重连定时器 */
  protected reconnectTimer: number | null = null

  /** 消息回调列表 */
  protected callbackList: MessageCallbackEntry<unknown>[] = []

  /** 当前连接的 URL */
  protected currentUrl: string | null = null

  /** 配置选项 */
  protected config: Required<WebSocketConfig>

  /** 重连次数 */
  protected reconnectAttempts = 0

  /** 是否手动关闭 */
  protected manualClose = false

  /** 日志器 */
  protected readonly logger: Logger

  /**
   * 默认配置
   */
  protected static readonly DEFAULT_CONFIG: Required<WebSocketConfig> = {
    url: '',
    heartbeatInterval: 25000,
    maxReconnectAttempts: 10,
    reconnectDelay: 3000,
    reconnectDelayMax: 10000,
    autoReconnect: true,
    heartbeatMessage: () => ({
      type: 'PING',
      timestamp: Date.now(),
    }),
    logLevel: 'warn',
  }

  /**
   * 构造函数
   * @param config 配置选项
   */
  constructor(config: WebSocketConfig = {}) {
    this.config = { ...WebSocketClient.DEFAULT_CONFIG, ...config }
    this.logger = new Logger('WebSocketClient', this.config.logLevel)
  }

  /**
   * 更新配置
   * @param config 新的配置选项
   */
  public updateConfig(config: Partial<WebSocketConfig>): void {
    this.config = { ...this.config, ...config }
    this.logger.setLevel(this.config.logLevel ?? WebSocketClient.DEFAULT_CONFIG.logLevel)
  }

  /**
   * 连接到 WebSocket 服务器
   * @param url WebSocket 地址（可选，如果不传则使用配置中的 url）
   */
  public connect(url?: string): void {
    const targetUrl = url || this.config.url
    if (!targetUrl) {
      this.logger.error('[WebSocketClient] 缺少 WebSocket URL')
      return
    }

    this.currentUrl = targetUrl
    this.manualClose = false

    try {
      this.socket = new WebSocket(targetUrl)

      this.socket.onopen = () => {
        this.logger.info('[WebSocketClient] 连接成功')
        this.reconnectAttempts = 0
        this.startHeartbeat()
        this.onOpen()
      }

      this.socket.onmessage = (event: MessageEvent) => {
        this.handleIncoming(event.data)
      }

      this.socket.onclose = (event: CloseEvent) => {
        this.logger.info('[WebSocketClient] 连接关闭', event.code, event.reason)
        this.stopHeartbeat()
        this.onClose(event)

        if (!this.manualClose && this.config.autoReconnect) {
          this.scheduleReconnect()
        }
      }

      this.socket.onerror = (event: Event) => {
        this.logger.error('[WebSocketClient] 连接错误', event)
        this.stopHeartbeat()
        this.onError(event)
      }
    } catch (error) {
      this.logger.error('[WebSocketClient] 连接失败', error)
      if (this.config.autoReconnect && !this.manualClose) {
        this.scheduleReconnect()
      }
    }
  }

  /**
   * 计划重连
   */
  protected scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts || !this.currentUrl || this.manualClose) {
      if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
        this.logger.warn('[WebSocketClient] 已达到最大重连次数')
      }
      return
    }

    this.reconnectAttempts += 1
    const delay = Math.min(this.config.reconnectDelay * this.reconnectAttempts, this.config.reconnectDelayMax)

    this.logger.debug(`[WebSocketClient] 将在 ${delay}ms 后进行第 ${this.reconnectAttempts} 次重连`)

    this.reconnectTimer = window.setTimeout(() => {
      this.connect(this.currentUrl!)
    }, delay)
  }

  /**
   * 断开连接
   */
  public disconnect(): void {
    this.manualClose = true
    this.stopHeartbeat()

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    this.currentUrl = null
    this.reconnectAttempts = 0
  }

  /**
   * 发送消息
   * @param data 消息数据
   */
  public send(data: string | object): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.logger.warn('[WebSocketClient] WebSocket 未连接，无法发送消息')
      return
    }

    const message = typeof data === 'string' ? data : JSON.stringify(data)
    this.socket.send(message)
  }

  /**
   * 处理接收的消息
   * @param data 接收到的数据
   */
  protected handleIncoming(data: string): void {
    if (!data) return

    let message: MessageData
    try {
      message = JSON.parse(data)
    } catch {
      this.logger.warn('[WebSocketClient] 无法解析消息', data)
      return
    }

    if (!message?.type) {
      return
    }

    // 触发匹配的回调
    const matched = this.callbackList.filter((entry) => entry.type === message.type)
    matched.forEach(({ callback }) => {
      try {
        callback(message.data, message)
      } catch (error) {
        this.logger.error('[WebSocketClient] 回调执行失败', error)
      }
    })

    // 调用钩子
    this.onMessage(message)
  }

  /**
   * 启动心跳
   */
  protected startHeartbeat(): void {
    this.stopHeartbeat()

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return
    }

    this.heartbeatTimer = window.setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return
      }

      const heartbeatData = this.config.heartbeatMessage()
      this.send(heartbeatData)
    }, this.config.heartbeatInterval)
  }

  /**
   * 停止心跳
   */
  protected stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 注册消息回调
   * @param entry 回调配置
   */
  public on<T = unknown>(type: string, callback: MessageCallback<T>): void
  public on<T = unknown>(entry: MessageCallbackEntry<T>): void
  public on<T = unknown>(typeOrEntry: string | MessageCallbackEntry<T>, callback?: MessageCallback<T>): void {
    const entry: MessageCallbackEntry<T> =
      typeof typeOrEntry === 'string' ? { type: typeOrEntry, callback: callback! } : typeOrEntry

    if (!entry.type || typeof entry.callback !== 'function') {
      this.logger.warn('[WebSocketClient] 无效的回调配置', entry)
      return
    }

    this.callbackList.push(entry as MessageCallbackEntry<unknown>)
  }

  /**
   * 取消注册消息回调
   * @param type 消息类型
   * @param callback 回调函数（可选，如果不传则移除该类型的所有回调）
   */
  public off<T = unknown>(type: string, callback?: MessageCallback<T>): void {
    if (callback) {
      this.callbackList = this.callbackList.filter((entry) => !(entry.type === type && entry.callback === callback))
    } else {
      this.callbackList = this.callbackList.filter((entry) => entry.type !== type)
    }
  }

  /**
   * 清空所有回调
   */
  public clearCallbacks(): void {
    this.callbackList = []
  }

  /**
   * 获取当前连接状态
   */
  public getReadyState(): number {
    return this.socket?.readyState ?? WebSocket.CLOSED
  }

  /**
   * 是否已连接
   */
  public isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  // ========== 钩子方法（子类可以重写） ==========

  /**
   * 连接打开时的钩子
   */
  protected onOpen(): void {
    // 子类可以重写
    this.logger.info('[WebSocketClient] 连接打开')
  }

  /**
   * 连接关闭时的钩子
   */
  protected onClose(_event: CloseEvent): void {
    // 子类可以重写
    this.logger.info('[WebSocketClient] 连接打开')
  }

  /**
   * 连接错误时的钩子
   */
  protected onError(_event: Event): void {
    // 子类可以重写
    this.logger.error('[WebSocketClient] 连接错误', _event)
  }

  /**
   * 收到消息时的钩子
   */
  protected onMessage(_message: MessageData): void {
    // 子类可以重写
    this.logger.debug('[WebSocketClient] 收到消息', _message)
  }
}
