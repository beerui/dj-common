import test from 'node:test'
import assert from 'node:assert/strict'

import { SharedWorkerManager } from '../dist/index.esm.js'

function createManager(sentMessages = []) {
  const manager = new SharedWorkerManager({
    url: 'ws://example.test/socket',
    userId: 'user-1',
    token: 'token-1',
    isVisible: true,
    config: {
      heartbeatInterval: 25000,
      maxReconnectAttempts: 3,
      reconnectDelay: 1000,
      reconnectDelayMax: 5000,
      autoReconnect: true,
      logLevel: 'silent',
      enableNetworkListener: true,
      url: '',
      heartbeatMessage: () => ({ type: 'PING' }),
    },
    logLevel: 'silent',
  })

  manager.port = {
    postMessage(message) {
      sentMessages.push(message)
    },
  }

  return manager
}

test('registerCallback 可声明不接收历史回放消息', () => {
  const sentMessages = []
  const manager = createManager(sentMessages)

  manager.registerCallback({
    type: 'NOTICE',
    receiveHistoryMessage: false,
    callback: () => {},
  })

  assert.equal(sentMessages.length, 1)
  assert.equal(sentMessages[0].type, 'TAB_REGISTER_CALLBACK')
  assert.equal(sentMessages[0].payload.type, 'NOTICE')
  assert.equal(sentMessages[0].payload.receiveHistoryMessage, false)
})

test('历史回放只触发允许接收历史消息的 callback，实时推送仍触发全部匹配回调', () => {
  const manager = createManager()
  const callbackResults = []

  const skipHistoryCallbackId = manager.registerCallback({
    type: 'NOTICE',
    receiveHistoryMessage: false,
    callback: (data) => {
      callbackResults.push(`skip:${data.kind}`)
    },
  })

  const receiveHistoryCallbackId = manager.registerCallback({
    type: 'NOTICE',
    callback: (data) => {
      callbackResults.push(`receive:${data.kind}`)
    },
  })

  manager.handleServerMessage({
    data: '{"type":"NOTICE"}',
    message: {
      type: 'NOTICE',
      data: { kind: 'history' },
    },
    isHistoryMessage: true,
    targetCallbackId: receiveHistoryCallbackId,
  })

  assert.deepEqual(callbackResults, ['receive:history'])

  manager.handleServerMessage({
    data: '{"type":"NOTICE"}',
    message: {
      type: 'NOTICE',
      data: { kind: 'push' },
    },
  })

  assert.deepEqual(callbackResults, ['receive:history', 'skip:push', 'receive:push'])
  assert.match(skipHistoryCallbackId, /^callback_/)
})
