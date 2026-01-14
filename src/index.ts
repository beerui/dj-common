/**
 * @brewer/dj-common - 多端通用的公共方法库
 * 支持 PC、H5、APP 等平台
 */

export { WebSocketClient } from './WebSocketClient'
export type { WebSocketConfig, MessageData, MessageCallback, MessageCallbackEntry } from './WebSocketClient'

export { MessageSocket } from './MessageSocket'
export type { MessageSocketConfig, MessageSocketStartOptions } from './MessageSocket'

export { SharedWorkerManager } from './SharedWorkerManager'
export type { SharedWorkerManagerConfig } from './SharedWorkerManager'

export { Logger } from './logger'
export type { LogLevel } from './logger'

// 导出 SharedWorker 相关类型
export type {
  ConnectionMode,
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
  TabInfo,
  SharedWorkerConfig,
} from './types'
