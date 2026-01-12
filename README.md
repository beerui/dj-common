# @beerui/dj-common

多端通用的公共方法库，支持 PC、H5、APP 等平台。

## 安装

```bash
npm install @beerui/dj-common
# 或
yarn add @beerui/dj-common
# 或
pnpm add @beerui/dj-common
```

## 功能模块

### MessageSocket - WebSocket 消息管理

用于管理 WebSocket 连接，支持心跳、自动重连、消息回调等功能。

#### 使用示例

```javascript
import { MessageSocket } from '@beerui/dj-common'

// 启动连接
MessageSocket.start({
  userId: '1234567890',
  token: 'your-token',
  callbacks: [
    {
      type: 'UNREAD_COUNT',
      callback: (payload, message) => {
        console.log('未读消息数:', payload)
      }
    }
  ]
})

// 停止连接
MessageSocket.stop()

// 动态注册回调
MessageSocket.registerCallbacks({
  type: 'NEW_MESSAGE',
  callback: (payload) => {
    console.log('新消息:', payload)
  }
})
```

#### API 说明

##### `MessageSocket.start(options)`

启动 WebSocket 连接

**参数:**
- `options.userId` (string, 必需): 用户ID
- `options.token` (string, 必需): 认证令牌
- `options.callbacks` (Array, 可选): 回调列表

##### `MessageSocket.stop()`

停止 WebSocket 连接并清理所有资源

##### `MessageSocket.registerCallbacks(entry)`

注册消息回调

**参数:**
- `entry.type` (string, 必需): 消息类型
- `entry.callback` (Function, 必需): 回调函数

**注意:** 目前不允许重名的回调类型

---

## 按需引入

你可以单独引入某个模块：

```javascript
// 只引入 MessageSocket
import MessageSocket from '@dj/common/message-socket'

```

## 浏览器兼容性

支持所有现代浏览器：
- Chrome >= 60
- Firefox >= 60
- Safari >= 11
- Edge >= 79

## 构建

```bash
# 安装依赖
npm install

# 构建
npm run build

# 开发模式（监听文件变化）
npm run dev
```

## 发布

```bash
# 发布到 npm
npm publish
```

## License

