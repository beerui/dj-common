// 基础测试示例
import { WebSocketClient } from '../../dist/index.esm.js'

console.log('🧪 开始测试 dj-common...\n')

// 测试 1: 创建实例
console.log('✓ 测试 1: 创建 WebSocketClient 实例')
try {
  const client = new WebSocketClient({
    heartbeatInterval: 30000,
    maxReconnectAttempts: 5,
    autoReconnect: true,
  })
  console.log('  ✅ 实例创建成功')
  console.log('  配置:', {
    heartbeatInterval: 30000,
    maxReconnectAttempts: 5,
    autoReconnect: true,
  })
} catch (error) {
  console.error('  ❌ 实例创建失败:', error.message)
  process.exit(1)
}

// 测试 2: 注册消息回调
console.log('\n✓ 测试 2: 注册消息回调')
try {
  const client = new WebSocketClient()
  client.on('test-message', (data) => {
    console.log('收到消息:', data)
  })
  console.log('  ✅ 消息回调注册成功')
} catch (error) {
  console.error('  ❌ 消息回调注册失败:', error.message)
  process.exit(1)
}

// 测试 3: 检查类型导出
console.log('\n✓ 测试 3: 检查导出')
try {
  console.log('  ✅ WebSocketClient 已导出')
  console.log('  类型:', typeof WebSocketClient)
} catch (error) {
  console.error('  ❌ 导出检查失败:', error.message)
  process.exit(1)
}

console.log('\n🎉 所有测试通过！\n')
console.log('💡 提示：')
console.log('  - 要测试 WebSocket 连接，需要启动一个 WebSocket 服务器')
console.log('  - 然后取消注释下面的连接代码\n')

// 实际连接测试（需要 WebSocket 服务器）
// console.log('✓ 测试 4: 连接 WebSocket 服务器')
// const client = new WebSocketClient()
// client.connect('ws://localhost:8080')
