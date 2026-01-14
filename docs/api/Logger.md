# Logger

> 轻量级日志管理类，提供多级别日志控制

## 安装

```bash
npm install @brewer/dj-common
```

## 导入

```typescript
import { Logger } from '@brewer/dj-common'
// 或
import Logger from '@brewer/dj-common/logger'
```

## 概述

`Logger` 是一个简单而强大的日志管理类，提供了：

- 📝 多级别日志（debug/info/warn/error/silent）
- 🎯 优先级控制（只输出大于等于设定级别的日志）
- 🏷️ 带名称前缀的日志输出
- ⚙️ 运行时动态调整日志级别

## API

### 构造函数

```typescript
constructor(name: string, level?: LogLevel)
```

创建 Logger 实例。

**参数**：

| 参数名 | 类型     | 必填 | 默认值 | 说明                                 |
| ------ | -------- | ---- | ------ | ------------------------------------ |
| name   | string   | 是   | -      | 日志名称，会作为前缀显示在每条日志中 |
| level  | LogLevel | 否   | 'warn' | 初始日志级别                         |

**示例**：

```typescript
const logger = new Logger('MyApp')
const debugLogger = new Logger('DebugModule', 'debug')
```

### setLevel()

```typescript
setLevel(level: LogLevel): void
```

设置日志级别。

**参数**：

| 参数名 | 类型     | 必填 | 默认值 | 说明     |
| ------ | -------- | ---- | ------ | -------- |
| level  | LogLevel | 是   | -      | 日志级别 |

**示例**：

```typescript
logger.setLevel('debug') // 输出所有级别的日志
logger.setLevel('error') // 只输出错误日志
logger.setLevel('silent') // 不输出任何日志
```

### getLevel()

```typescript
getLevel(): LogLevel
```

获取当前日志级别。

**返回值**：

当前的日志级别。

**示例**：

```typescript
const currentLevel = logger.getLevel()
console.log(currentLevel) // 'warn'
```

### debug()

```typescript
debug(...values: unknown[]): void
```

输出 debug 级别的日志。

**参数**：

| 参数名 | 类型      | 必填 | 默认值 | 说明             |
| ------ | --------- | ---- | ------ | ---------------- |
| values | unknown[] | 是   | -      | 要输出的日志内容 |

**示例**：

```typescript
logger.debug('调试信息')
logger.debug('用户数据:', { id: 1, name: 'Alice' })
logger.debug('多个参数', 123, true, { a: 1 })
```

### info()

```typescript
info(...values: unknown[]): void
```

输出 info 级别的日志。

**参数**：

| 参数名 | 类型      | 必填 | 默认值 | 说明             |
| ------ | --------- | ---- | ------ | ---------------- |
| values | unknown[] | 是   | -      | 要输出的日志内容 |

**示例**：

```typescript
logger.info('应用启动成功')
logger.info('当前版本:', '1.0.0')
```

### warn()

```typescript
warn(...values: unknown[]): void
```

输出 warn 级别的日志。

**参数**：

| 参数名 | 类型      | 必填 | 默认值 | 说明             |
| ------ | --------- | ---- | ------ | ---------------- |
| values | unknown[] | 是   | -      | 要输出的日志内容 |

**示例**：

```typescript
logger.warn('配置文件未找到，使用默认配置')
logger.warn('API 响应时间过长:', responseTime)
```

### error()

```typescript
error(...values: unknown[]): void
```

输出 error 级别的日志。

**参数**：

| 参数名 | 类型      | 必填 | 默认值 | 说明             |
| ------ | --------- | ---- | ------ | ---------------- |
| values | unknown[] | 是   | -      | 要输出的日志内容 |

**示例**：

```typescript
logger.error('连接失败')
logger.error('错误详情:', error)
```

## 类型定义

### LogLevel

日志级别类型

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'
```

**级别说明**：

- `debug` - 优先级 10（最详细，包括所有调试信息）
- `info` - 优先级 20（一般信息）
- `warn` - 优先级 30（警告信息，默认级别）
- `error` - 优先级 40（错误信息）
- `silent` - 优先级 50（静默模式，不输出任何日志）

**优先级规则**：

只有日志级别的优先级 >= 当前设定的级别优先级时，日志才会被输出。

例如：

- 设置为 `'warn'` 时，只会输出 `warn` 和 `error` 级别的日志
- 设置为 `'debug'` 时，会输出所有级别的日志
- 设置为 `'silent'` 时，不会输出任何日志

## 完整示例

### 基础使用

```typescript
import { Logger } from '@brewer/dj-common'

// 创建 logger 实例
const logger = new Logger('MyApp', 'debug')

// 输出不同级别的日志
logger.debug('这是调试信息')
logger.info('应用启动成功')
logger.warn('这是一个警告')
logger.error('发生了错误')

// 动态修改日志级别
logger.setLevel('warn')
logger.debug('这条不会输出') // 因为 debug < warn
logger.warn('这条会输出') // 因为 warn >= warn
```

输出结果：

```
[MyApp] 这是调试信息
[MyApp] 应用启动成功
[MyApp] 这是一个警告
[MyApp] 发生了错误
[MyApp] 这条会输出
```

### 在应用中使用

```typescript
import { Logger } from '@brewer/dj-common'

class DataService {
  private logger: Logger

  constructor() {
    this.logger = new Logger('DataService', 'info')
  }

  async fetchData() {
    this.logger.info('开始获取数据')

    try {
      const data = await fetch('/api/data')
      this.logger.debug('获取到的数据:', data)
      return data
    } catch (error) {
      this.logger.error('获取数据失败:', error)
      throw error
    }
  }

  // 开启调试模式
  enableDebug() {
    this.logger.setLevel('debug')
  }
}
```

### 根据环境配置日志级别

```typescript
import { Logger } from '@brewer/dj-common'

// 根据环境变量设置日志级别
const logLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
const logger = new Logger('App', logLevel)

logger.debug('这在生产环境不会输出')
logger.warn('这在所有环境都会输出')
```

### 多模块日志管理

```typescript
import { Logger } from '@brewer/dj-common'

// 为不同模块创建独立的 logger
const apiLogger = new Logger('API', 'info')
const dbLogger = new Logger('Database', 'debug')
const authLogger = new Logger('Auth', 'warn')

apiLogger.info('API 请求', '/users')
dbLogger.debug('查询数据库', 'SELECT * FROM users')
authLogger.warn('登录失败', '用户名不存在')
```

输出：

```
[API] API 请求 /users
[Database] 查询数据库 SELECT * FROM users
[Auth] 登录失败 用户名不存在
```

## 使用场景

### 1. 开发调试

```typescript
const logger = new Logger('DevTool', 'debug')

logger.debug('变量值:', someVariable)
logger.debug('函数参数:', arg1, arg2, arg3)
```

### 2. 生产监控

```typescript
const logger = new Logger('Production', 'error')

// 只记录错误，不输出调试信息
logger.debug('这不会输出')
logger.error('严重错误', errorDetails)
```

### 3. 性能追踪

```typescript
const perfLogger = new Logger('Performance', 'info')

const start = Date.now()
await someOperation()
const duration = Date.now() - start

perfLogger.info(`操作耗时: ${duration}ms`)
```

### 4. WebSocket 日志

```typescript
import { WebSocketClient, Logger } from '@brewer/dj-common'

// WebSocketClient 内部使用 Logger
const client = new WebSocketClient({
  url: 'ws://localhost:8080',
  logLevel: 'debug', // 设置 WebSocket 的日志级别
})
```

## 注意事项

1. **日志级别选择**：
   - 开发环境：使用 `'debug'` 查看详细信息
   - 测试环境：使用 `'info'` 查看关键流程
   - 生产环境：使用 `'warn'` 或 `'error'` 减少日志输出

2. **性能考虑**：
   - 日志调用本身有性能开销，生产环境避免过多的 debug 日志
   - 使用合适的日志级别可以减少不必要的日志输出

3. **日志内容**：
   - 避免在日志中输出敏感信息（如密码、token）
   - 提供足够的上下文信息便于问题排查

4. **名称前缀**：
   - 使用有意义的名称便于日志过滤和定位
   - 建议使用模块名或类名作为前缀

## 相关链接

- [GitHub 仓库](https://github.com/beerui/dj-common)
- [NPM 包](https://www.npmjs.com/package/@brewer/dj-common)
- [WebSocketClient API](./WebSocketClient.md)
- [MessageSocket API](./MessageSocket.md)
