/**
 * MessageSocket 配置选项
 */
export interface MessageSocketOptions {
  /** 用户ID */
  userId: string
  /** 认证令牌 */
  token: string
  /** 消息回调列表 */
  callbacks?: MessageSocketCallback[]
}

/**
 * 消息回调配置
 */
export interface MessageSocketCallback {
  /** 消息类型 */
  type: string
  /** 回调函数 */
  callback: (payload: any, message?: MessageData) => void
}

/**
 * 消息数据结构
 */
export interface MessageData {
  /** 消息类型 */
  type: string
  /** 消息数据 */
  data: any
  /** 元数据 */
  meta?: Record<string, any>
  /** 时间戳 */
  timestamp?: number
}

/**
 * WebSocket 消息管理类
 * 用于管理 WebSocket 连接，支持心跳、自动重连、消息回调等功能
 */
export declare class MessageSocket {
  /** WebSocket 连接实例 */
  static socket: WebSocket | null

  /** 心跳定时器 */
  static heartbeatTimer: NodeJS.Timeout | null

  /** 重连定时器 */
  static reconnectTimer: NodeJS.Timeout | null

  /** 回调列表 */
  static callbackList: MessageSocketCallback[]

  /** 当前用户ID */
  static currentUserId: string | null

  /** 当前token */
  static currentToken: string | null

  /** 最大重连次数 */
  static maxReconnectAttempts: number

  /** 重连次数 */
  static reconnectAttempts: number

  /** 重连延迟 */
  static reconnectDelay: number

  /** 最大重连延迟 */
  static reconnectDelayMax: number

  /**
   * 启动 WebSocket 连接
   * @param options 配置选项
   */
  static start(options: MessageSocketOptions): void

  /**
   * 连接到 WebSocket 服务器
   * @param url WebSocket 地址
   */
  static connect(url: string): void

  /**
   * 计划重连
   * @param url WebSocket 地址
   */
  static scheduleReconnect(url: string): void

  /**
   * 停止连接
   */
  static stop(): void

  /**
   * 处理接收的数据
   * @param data 接收到的数据
   */
  static handleIncoming(data: string | MessageData): void

  /**
   * 启动心跳
   */
  static startHeartbeat(): void

  /**
   * 停止心跳
   */
  static stopHeartbeat(): void

  /**
   * 注册回调
   * @param entry 回调配置
   */
  static registerCallbacks(entry: MessageSocketCallback): void
}

export default MessageSocket
