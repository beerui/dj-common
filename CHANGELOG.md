# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.0.1](https://github.com/beerui/dj-common/releases/tag/v1.0.1) (2026-01-17)

### Bug Fixes

- **SharedWorkerManager**: 修复空闲超时后标签页无法重新接收消息的问题
  - 当所有标签页不可见导致 SharedWorker 空闲超时断开连接后，用户再次切换回标签页时，消息无法正常接收
  - 新增 `WORKER_TAB_NOT_FOUND` 消息类型，当 Worker 发现标签页不存在时主动通知标签页重新初始化
  - 优化 `updateTabVisibility` 方法，返回布尔值表示操作是否成功
  - SharedWorkerManager 收到 `WORKER_TAB_NOT_FOUND` 后自动调用 `reinitialize()` 恢复连接

## [1.0.0](https://github.com/beerui/dj-common/releases/tag/v1.0.0) (2026-01-17)

### Features

- 多端通用的公共方法库，支持 PC、H5、APP 等平台
- WebSocket 客户端封装（WebSocketClient）
  - 连接管理（connect/disconnect）
  - 心跳检测（自动发送 PING）
  - 自动重连（指数退避策略）
  - 消息回调系统（type-based routing）
  - 日志系统（可配置的日志级别）
  - 生命周期钩子（onOpen/onClose/onError/onMessage）
- 消息管理类（MessageSocket）
  - 用户认证（userId + token）
  - URL 构建（baseUrl + path + 认证参数）
  - 全局消息管理
  - 三种连接模式（sharedWorker / visibility / normal）
  - 自动降级策略
- SharedWorker 支持
  - 跨标签页共享 WebSocket 连接
  - 空闲超时管理（所有标签页不可见时延迟断开）
  - 自动降级到 Visibility 模式
- 页面可见性管理
  - 支持多标签页场景下的连接优化
  - 标签页不可见时自动断开，可见时自动重连
- 网络状态监听
  - 监听 online/offline 事件
  - 网络恢复时自动重置重连计数并立即重连
  - 解决移动端断网较久后无法自动重连的问题
- 日志系统（Logger）
  - 多级别日志（debug/info/warn/error/silent）
  - 优先级控制
  - 带名称前缀的日志输出
- 完整的 TypeScript 类型定义
- 支持 ESM 和 CommonJS 两种模块格式
- 支持按需引入
