# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.0.0-beta.15](https://github.com/beerui/dj-common/compare/v1.0.0-beta.14...v1.0.0-beta.15) (2026-01-15)

### Features

- 添加网络状态监听功能，解决移动端断网较久后无法自动重连的问题
- WebSocketClient 新增 `enableNetworkListener` 配置项（默认 true）
- 监听 `online`/`offline` 事件，网络恢复时自动重置重连计数并立即重连
- SharedWorker 模式同步支持网络恢复自动重连

### Bug Fixes

- 修复断网超过重连次数上限后，网络恢复时无法自动重连的问题

## [1.0.0-beta.12](https://github.com/beerui/dj-common/compare/v1.0.0-beta.11...v1.0.0-beta.12) (2026-01-14)

### Features

- 添加页面可见性管理功能，支持多标签页场景下的连接优化
- 新增 `enableVisibilityManagement` 配置选项
- 标签页不可见时自动断开连接，可见时自动重连

### Documentation

- 更新 CLAUDE.md 架构说明
- 更新 README.md 添加多标签页管理示例
- 更新 MessageSocket API 文档

## [1.0.0-beta.3](https://github.com/beerui/dj-common/compare/v1.0.0-beta.2...v1.0.0-beta.3) (2026-01-13)

### Documentation

- 优化发布技能文档，加快 npm 发布流程

## [1.0.0-beta.2](https://github.com/beerui/dj-common/compare/v1.0.0-beta.1...v1.0.0-beta.2) (2026-01-13)

### Documentation

- 更新 MessageSocket 文档和示例
- 添加 CLAUDE.md 为未来的 Claude Code 实例提供项目指导
- 修改 MessageSocket中的baseUrl，ws 修改为 wss

## [1.0.0-beta.1](https://github.com/beerui/dj-common/compare/v1.0.0-beta.0...v1.0.0-beta.1) (2026-01-13)

### Changes

- 优化 npm 发布配置，只包含必要文件（dist、README.md、LICENSE）

## [1.0.0-beta.0](https://github.com/beerui/dj-common/releases/tag/v1.0.0-beta.0) (2026-01-13)

### Features

- 初始 beta 版本发布
- 提供多端通用的公共方法库
- 支持 WebSocket 客户端封装
- 支持消息队列处理
