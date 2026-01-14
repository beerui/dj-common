/**
 * @brewer/dj-common - 多端通用的公共方法库
 * 支持 PC、H5、APP 等平台
 */

export { WebSocketClient } from './WebSocketClient'
export type { WebSocketConfig, MessageData, MessageCallback, MessageCallbackEntry } from './WebSocketClient'

export { MessageSocket } from './MessageSocket'
export type { MessageSocketConfig, MessageSocketStartOptions } from './MessageSocket'

export { Logger } from './logger'
export type { LogLevel } from './logger'
