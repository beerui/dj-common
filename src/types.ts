/**
 * SharedWorker 相关类型定义
 * 定义标签页和 Worker 之间的消息协议
 */

import type { WebSocketConfig } from './WebSocketClient'

/**
 * 标签页到 Worker 的消息类型
 */
export enum TabToWorkerMessageType {
  /** 初始化连接 */
  TAB_INIT = 'TAB_INIT',
  /** 发送消息到服务器 */
  TAB_SEND = 'TAB_SEND',
  /** 标签页可见性变化 */
  TAB_VISIBILITY = 'TAB_VISIBILITY',
  /** 注册消息回调 */
  TAB_REGISTER_CALLBACK = 'TAB_REGISTER_CALLBACK',
  /** 取消注册消息回调 */
  TAB_UNREGISTER_CALLBACK = 'TAB_UNREGISTER_CALLBACK',
  /** 断开连接 */
  TAB_DISCONNECT = 'TAB_DISCONNECT',
  /** PING 心跳 */
  TAB_PING = 'TAB_PING',
  /** 强制关闭 Worker（用于退出登录/强制重置连接） */
  TAB_FORCE_SHUTDOWN = 'TAB_FORCE_SHUTDOWN',
  /** 强制重置 Worker 状态（断开 WebSocket 但不终止 Worker） */
  TAB_FORCE_RESET = 'TAB_FORCE_RESET',
  /** 网络已恢复（通知 Worker 重试连接） */
  TAB_NETWORK_ONLINE = 'TAB_NETWORK_ONLINE',
}

/**
 * Worker 到标签页的消息类型
 */
export enum WorkerToTabMessageType {
  /** Worker 已就绪 */
  WORKER_READY = 'WORKER_READY',
  /** 服务器消息 */
  WORKER_MESSAGE = 'WORKER_MESSAGE',
  /** WebSocket 已连接 */
  WORKER_CONNECTED = 'WORKER_CONNECTED',
  /** WebSocket 已断开 */
  WORKER_DISCONNECTED = 'WORKER_DISCONNECTED',
  /** 连接错误 */
  WORKER_ERROR = 'WORKER_ERROR',
  /** 身份冲突警告 */
  WORKER_AUTH_CONFLICT = 'WORKER_AUTH_CONFLICT',
  /** PONG 响应 */
  WORKER_PONG = 'WORKER_PONG',
}

/**
 * 标签页到 Worker 的消息
 */
export interface TabToWorkerMessage {
  /** 消息类型 */
  type: TabToWorkerMessageType
  /** 消息负载 */
  payload?: unknown
  /** 标签页ID */
  tabId: string
  /** 时间戳 */
  timestamp: number
}

/**
 * Worker 到标签页的消息
 */
export interface WorkerToTabMessage {
  /** 消息类型 */
  type: WorkerToTabMessageType
  /** 消息负载 */
  payload?: unknown
  /** 时间戳 */
  timestamp: number
}

/**
 * 初始化负载
 */
export interface InitPayload {
  /** WebSocket 服务器地址 */
  url: string
  /** 用户ID */
  userId: string
  /** 认证令牌 */
  token: string
  /** 标签页是否可见 */
  isVisible: boolean
  /** WebSocket 配置 */
  config: WebSocketConfig
  /** SharedWorker 空闲超时时间（毫秒） */
  sharedWorkerIdleTimeout?: number
}

/**
 * 发送消息负载
 */
export interface SendPayload {
  /** 消息数据 */
  data: string | object
}

/**
 * 可见性变化负载
 */
export interface VisibilityPayload {
  /** 是否可见 */
  isVisible: boolean
}

/**
 * 注册回调负载
 */
export interface RegisterCallbackPayload {
  /** 消息类型 */
  type: string
  /** 回调ID（用于取消注册） */
  callbackId: string
}

/**
 * 取消注册回调负载
 */
export interface UnregisterCallbackPayload {
  /** 消息类型 */
  type: string
  /** 回调ID（可选，如果不传则移除该类型的所有回调） */
  callbackId?: string
}

/**
 * 服务器消息负载
 */
export interface ServerMessagePayload {
  /** 原始消息数据 */
  data: string
  /** 解析后的消息对象 */
  message: {
    type: string
    data: unknown
    meta?: Record<string, unknown>
    timestamp?: number
  }
}

/**
 * 错误负载
 */
export interface ErrorPayload {
  /** 错误消息 */
  message: string
  /** 错误详情 */
  error?: unknown
}

/**
 * 身份冲突负载
 */
export interface AuthConflictPayload {
  /** 当前连接的用户ID */
  currentUserId: string
  /** 新标签页尝试连接的用户ID */
  newUserId: string
  /** 警告消息 */
  message: string
}

/**
 * 标签页信息
 */
export interface TabInfo {
  /** MessagePort 实例 */
  port: MessagePort
  /** 标签页ID */
  tabId: string
  /** 是否可见 */
  isVisible: boolean
  /** 注册的消息类型 */
  registeredTypes: Set<string>
  /** 回调ID映射表（callbackId -> type） */
  callbackMap: Map<string, string>
}

/**
 * 连接模式
 */
export type ConnectionMode = 'auto' | 'sharedWorker' | 'visibility' | 'normal'

/**
 * SharedWorker 配置
 */
export interface SharedWorkerConfig {
  /** 连接模式，默认 'auto' */
  connectionMode?: ConnectionMode
  /** SharedWorker 空闲超时时间（毫秒），默认 30000 */
  sharedWorkerIdleTimeout?: number
}
