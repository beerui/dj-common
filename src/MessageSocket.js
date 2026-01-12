const DEFAULT_HEARTBEAT_INTERVAL = 25000
const DEFAULT_BASE_URL = 'ws://dev-gateway.chinamarket.cn'
const DEFAULT_PATH = '/api/user-web/websocket/messageServer'
/**
 * 消息socket
 * 用于获取用户未读消息数量
 * 使用方式：
 * MessageSocket.start({
 *   userId: '1234567890',
 *   token: '1234567890',
 *   callbacks: [{ type: 'UNREAD_COUNT', callback: (payload) => { console.log(payload) } }],
 * })
 * 停止连接：
 * MessageSocket.stop()
 * 注册回调：
 * MessageSocket.registerCallbacks({ type: 'UNREAD_COUNT', callback: (payload) => { console.log(payload) } })
 */
class MessageSocket {
  // 连接
  static socket = null
  // 心跳定时器
  static heartbeatTimer = null
  // 重连定时器
  static reconnectTimer = null
  // 回调列表
  static callbackList = []
  // 当前用户ID
  static currentUserId = null
  // 当前token
  static currentToken = null
  // 最大重连次数
  static maxReconnectAttempts = 10
  // 重连次数
  static reconnectAttempts = 0
  // 重连延迟
  static reconnectDelay = 3000
  // 最大重连延迟
  static reconnectDelayMax = 10000

  /**
   * 启动连接
   * @param {Object} options
   * @param {string} options.userId 用户ID
   * @param {string} options.token 令牌
   * @param {Array} options.callbacks 回调列表
   */
  static start(options) {
    const { userId, token, callbacks = [] } = options
    if (!userId || !token) {
      console.warn('[MessageSocket] 缺少 userId 或 token，无法启动')
      return
    }

    const shouldReuse =
      MessageSocket.socket &&
      MessageSocket.socket.readyState === WebSocket.OPEN &&
      MessageSocket.currentUserId === userId &&
      MessageSocket.currentToken === token

    // 如果连接存在且用户ID和token相同，则重新注册回调
    if (shouldReuse) {
      // 重新注册回调
      callbacks?.forEach((entry) => MessageSocket.registerCallbacks(entry))
      return
    }

    // 停止连接
    MessageSocket.stop()
    // 设置当前用户ID和token
    MessageSocket.currentUserId = userId
    // 设置当前token
    MessageSocket.currentToken = token
    // 注册回调
    callbacks?.forEach((entry) => MessageSocket.registerCallbacks(entry))

    // 构建URL
    const url = `${DEFAULT_BASE_URL}${DEFAULT_PATH}/${userId}?token=${encodeURIComponent(token)}`

    // 连接
    MessageSocket.connect(url)
  }

  /**
   * 连接
   * @param {string} url
   */
  static connect(url) {
    try {
      MessageSocket.socket = new WebSocket(url)
      MessageSocket.socket.onopen = () => {
        MessageSocket.reconnectAttempts = 0
        MessageSocket.startHeartbeat()
      }

      MessageSocket.socket.onmessage = (event) => {
        MessageSocket.handleIncoming(event.data)
      }

      MessageSocket.socket.onclose = () => {
        MessageSocket.stopHeartbeat()
        MessageSocket.scheduleReconnect(url)
      }

      MessageSocket.socket.onerror = () => {
        MessageSocket.stopHeartbeat()
      }
    } catch (error) {
      MessageSocket.scheduleReconnect(url)
    }
  }

  /**
   * 计划重连
   * @param {string} url
   */
  static scheduleReconnect(url) {
    if (
      MessageSocket.reconnectAttempts >= MessageSocket.maxReconnectAttempts ||
      !MessageSocket.currentUserId ||
      !MessageSocket.currentToken
    ) {
      return
    }

    MessageSocket.reconnectAttempts += 1
    const delay = Math.min(
      MessageSocket.reconnectDelay * MessageSocket.reconnectAttempts,
      MessageSocket.reconnectDelayMax,
    )

    MessageSocket.reconnectTimer = setTimeout(() => {
      MessageSocket.connect(url)
    }, delay)
  }

  /**
   * 停止连接
   */
  static stop() {
    MessageSocket.stopHeartbeat()
    if (MessageSocket.reconnectTimer) {
      clearTimeout(MessageSocket.reconnectTimer)
      MessageSocket.reconnectTimer = null
    }
    if (MessageSocket.socket) {
      MessageSocket.socket.close()
      MessageSocket.socket = null
    }
    MessageSocket.callbackList = []
    MessageSocket.currentUserId = null
    MessageSocket.currentToken = null
    MessageSocket.reconnectAttempts = 0
  }

  /**
   * 处理接收的数据
   * 
   * @param {string} data
   * data: 接收到的数据 - 格式与后端约定一致
   * 格式：
   * {
   *   type: 'UNREAD_COUNT', // 类型 与注册回调时的 type 一致
   *   data: { unreadCount: 1 }, // 数据 与注册回调时的 data 一致
   *   meta: { userId: '1234567890' }, // 元数据 与注册回调时的 meta 一致
   *   timestamp: 1715769600000 // 时间戳
   * }
   * 根据 type 调用对应的回调函数，业务方需要自己处理 data 和 meta 数据，此处只负责调用回调函数
   * 
   * !注意：目前回调不允许重名，后续可以考虑放开重名限制类似事件总线的方式，目前是在store中注册回调，所以一个变了全局都会变
   */
  static handleIncoming(data) {
    if (!data) return
    let message = data
    if (typeof data === 'string') {
      try {
        message = JSON.parse(data)
      } catch (error) {
        return
      }
    }

    if (!message?.type) {
      return
    }

    const matched = MessageSocket.callbackList.filter((entry) => entry.type === message.type)
    if (!matched.length) {
      return
    }

    matched.forEach(({ callback }) => {
      if (typeof callback !== 'function') return
      callback(message.data, message)
    })
  }

  /**
   * 启动心跳
   */
  static startHeartbeat() {
    MessageSocket.stopHeartbeat()
    // 如果连接不存在或连接状态不是 OPEN，则返回
    if (!MessageSocket.socket || MessageSocket.socket.readyState !== WebSocket.OPEN) return

    // 设置心跳定时器
    MessageSocket.heartbeatTimer = setInterval(() => {
      // 如果连接不存在或连接状态不是 OPEN，则返回
      if (!MessageSocket.socket || MessageSocket.socket.readyState !== WebSocket.OPEN) return
      // 发送 PING 消息 格式与后端约定一致
      MessageSocket.socket.send(
        JSON.stringify({
          type: 'PING',
          timestamp: Date.now(),
        }),
      )
    }, DEFAULT_HEARTBEAT_INTERVAL)
  }

  /**
   * 停止心跳
   */
  static stopHeartbeat() {
    if (MessageSocket.heartbeatTimer) {
      clearInterval(MessageSocket.heartbeatTimer)
      MessageSocket.heartbeatTimer = null
    }
  }

  /**
   * 注册回调
   * @param {Object} entry
   * entry: 回调信息 与注册回调时的 entry 一致
   * 格式：
   * {
   *   type: 'UNREAD_COUNT', // 类型 与注册回调时的 type 一致
   *   callback: (payload) => { console.log(payload) }, // 回调函数
   * }
   */
  static registerCallbacks(entry) {
    if (!entry) {
      console.warn('[MessageSocket] 注册回调失败，缺少 entry', entry)
      return
    }
    if (typeof entry !== 'object') {
      console.warn('[MessageSocket] 注册回调失败，缺少 entry 或 entry 不是对象', entry)
      return
    }
    if (typeof entry.callback !== 'function') {
      console.warn('[MessageSocket] 注册回调失败，缺少 callback 或 callback 不是函数', entry)
      return
    }
    if (typeof entry.type !== 'string') {
      console.warn('[MessageSocket] 注册回调失败，缺少 type 或 type 不是字符串', entry)
      return
    }
    if (MessageSocket.callbackList.find((item) => item.type === entry.type)) {
      console.warn('[MessageSocket] 注册回调失败，类型已存在', entry)
      return
    }
    MessageSocket.callbackList.push(entry)
  }

}

export default MessageSocket
