import { WebSocketClient, WebSocketConfig, MessageCallbackEntry } from './WebSocketClient'

/**
 * MessageSocket 配置选项
 */
export interface MessageSocketConfig extends WebSocketConfig {
  /** WebSocket 服务器基础地址，默认 'ws://dev-gateway.chinamarket.cn' */
  baseUrl?: string
  /** WebSocket 路径，默认 '/api/user-web/websocket/messageServer' */
  path?: string
  /** 消息回调列表 */
  callbacks?: MessageCallbackEntry[]
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
 */
export class MessageSocket {
  /** 默认配置 */
  private static readonly DEFAULT_CONFIG: MessageSocketConfig = {
    baseUrl: '',
    path: '',
    heartbeatInterval: 25000,
    maxReconnectAttempts: 10,
    reconnectDelay: 3000,
    reconnectDelayMax: 10000,
    autoReconnect: true,
    callbacks: [],
  }

  /** WebSocket 客户端实例 */
  private static client: WebSocketClient | null = null

  /** 当前用户ID */
  private static currentUserId: string | null = null

  /** 当前token */
  private static currentToken: string | null = null

  /** 当前配置 */
  private static config: MessageSocketConfig = { ...MessageSocket.DEFAULT_CONFIG }

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
    callbacks.forEach((entry) => MessageSocket.registerCallbacks(entry))
    return MessageSocket
  }

  /**
   * 启动连接
   * @param options 启动选项
   * 回调在开始的时候注册，这种能
   */
  public static start(options: MessageSocketStartOptions): void {
    if (!MessageSocket.config.baseUrl || !MessageSocket.config.path) {
      console.warn('[MessageSocket] 缺少配置 baseUrl 或 path, 请先调用 setConfig 设置配置!')
      return
    }

    const { userId, token } = options

    if (!userId || !token) {
      console.warn('[MessageSocket] 缺少 userId 或 token，无法启动')
      return
    }

    // 检查是否可以复用现有连接
    const shouldReuse =
      MessageSocket.client &&
      MessageSocket.client.isConnected() &&
      MessageSocket.currentUserId === userId &&
      MessageSocket.currentToken === token

    if (shouldReuse) {
      console.log('[MessageSocket] 复用现有连接')
      return
    }

    // 停止旧连接
    MessageSocket.stop()

    // 保存当前用户信息
    MessageSocket.currentUserId = userId
    MessageSocket.currentToken = token

    // 构建 WebSocket URL
    const { baseUrl, path, ...clientConfig } = MessageSocket.config
    const url = `${baseUrl}${path}/${userId}?token=${encodeURIComponent(token)}`

    // 创建新的 WebSocket 客户端
    MessageSocket.client = new WebSocketClient({
      ...clientConfig,
      url,
    })

    // 连接
    MessageSocket.client.connect()
  }

  /**
   * 停止连接
   */
  public static stop(): void {
    if (MessageSocket.client) {
      MessageSocket.client.disconnect()
      MessageSocket.client.clearCallbacks()
      MessageSocket.client = null
    }

    MessageSocket.currentUserId = null
    MessageSocket.currentToken = null
  }

  /**
   * 注册消息回调
   * @param entry 回调配置
   */
  public static registerCallbacks<T = unknown>(entry: MessageCallbackEntry<T>): void {
    if (!entry) {
      console.warn('[MessageSocket] 注册回调失败，缺少 entry', entry)
      return
    }

    if (typeof entry !== 'object') {
      console.warn('[MessageSocket] 注册回调失败，entry 不是对象', entry)
      return
    }

    if (typeof entry.callback !== 'function') {
      console.warn('[MessageSocket] 注册回调失败，callback 不是函数', entry)
      return
    }

    if (typeof entry.type !== 'string') {
      console.warn('[MessageSocket] 注册回调失败，type 不是字符串', entry)
      return
    }

    if (!MessageSocket.client) {
      console.warn('[MessageSocket] WebSocket 客户端未初始化，无法注册回调')
      return
    }

    MessageSocket.client.on(entry)
  }

  /**
   * 取消注册消息回调
   * @param type 消息类型
   * @param callback 回调函数（可选）
   */
  public static unregisterCallbacks<T = unknown>(type: string, callback?: (data: T, message?: unknown) => void): void {
    if (!MessageSocket.client) {
      return
    }

    MessageSocket.client.off(type, callback)
  }

  /**
   * 发送消息
   * @param data 消息数据
   */
  public static send(data: string | object): void {
    if (!MessageSocket.client) {
      console.warn('[MessageSocket] WebSocket 客户端未初始化，无法发送消息')
      return
    }

    MessageSocket.client.send(data)
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
    return MessageSocket.client?.isConnected() ?? false
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
