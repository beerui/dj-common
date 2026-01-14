# @brewer/dj-common

多端通用的公共方法库，支持 PC、H5、APP 等平台。使用 TypeScript 编写，提供完整的类型支持。

## ✨ 特性

- 📘 **TypeScript** - 完全使用 TypeScript 编写，提供完整的类型定义
- 📦 **多格式支持** - 同时提供 ESM 和 CommonJS 两种格式
- 🔌 **按需引入** - 支持独立引入模块，减小打包体积
- 🔧 **可配置** - 所有参数都可灵活配置
- 🔄 **自动重连** - 内置智能重连机制
- 💓 **心跳检测** - 自动维持连接活性
- 🎯 **类型安全** - 完整的 TypeScript 类型支持

## 安装

```bash
npm install @brewer/dj-common
# 或
yarn add @brewer/dj-common
# 或
pnpm add @brewer/dj-common
```

## 按需引入

你可以单独引入某个模块：

```typescript
// 只引入 WebSocketClient
import { WebSocketClient } from '@brewer/dj-common/WebSocketClient'

// 只引入 MessageSocket
import { MessageSocket } from '@brewer/dj-common/MessageSocket'
```

## TypeScript 支持

本库完全使用 TypeScript 编写，提供完整的类型定义：

```typescript
import type {
  WebSocketConfig,
  MessageData,
  MessageCallback,
  MessageCallbackEntry,
  MessageSocketConfig,
  MessageSocketStartOptions,
} from '@brewer/dj-common'
```

## 浏览器兼容性

支持所有现代浏览器：

- Chrome >= 60
- Firefox >= 60
- Safari >= 11
- Edge >= 79

## 开发

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 代码格式化
npm run format

# 构建
npm run build
```

## 发布

使用claude code时 只需发送 "帮我发布一个新版本" 即可

推送消息必须要是：`chore: bump version to 1.0.0-beta.7`

```bash
# 自动版本管理和发布
npm run release:patch  # 补丁版本 1.0.0 -> 1.0.1
npm run release:minor  # 次版本 1.0.0 -> 1.1.0
npm run release:major  # 主版本 1.0.0 -> 2.0.0

# 推送到远程
git push --follow-tags origin main

# 发布到 npm
npm publish
```

## 架构设计

```
@brewer/dj-common
├── WebSocketClient (基础类)
│   ├── 连接管理
│   ├── 心跳检测
│   ├── 自动重连
│   ├── 消息回调
│   └── 生命周期钩子
│
└── MessageSocket (业务类)
    ├── 继承 WebSocketClient
    ├── 用户认证
    └── 消息管理
```

**设计理念：**

- `WebSocketClient` 是通用的 WebSocket 基础封装，不依赖具体业务
- `MessageSocket` 基于 `WebSocketClient`，添加用户认证等业务功能
- 职责分离，易于扩展和维护

## 本地测试

```ts
npm link
# 在其他项目中
npm link @brewer/dj-common
```

## License

MIT

---

**Made with ❤️ by BeerUi**
