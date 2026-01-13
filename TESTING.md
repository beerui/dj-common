# 本地测试指南

## 测试前准备

### 1. 构建项目

首先确保项目已经构建：

```bash
npm run build
```

这会在 `dist/` 目录生成构建产物。

## 测试方法

### 方式一：使用 npm link（推荐）

这种方式可以在其他项目中测试你的包，就像从 npm 安装一样。

#### 步骤：

1. **在 dj-common 项目中创建全局链接**：

   ```bash
   # 在 dj-common 根目录执行
   npm link
   ```

   这会将当前包链接到全局 node_modules。

2. **在测试项目中使用链接**：

   ```bash
   # 在你的测试项目目录执行
   npm link @brewer/dj-common
   ```

3. **在测试项目中使用**：

   ```typescript
   import { WebSocketClient } from '@brewer/dj-common'

   const client = new WebSocketClient({
     heartbeatInterval: 30000,
     autoReconnect: true,
   })

   client.connect('ws://localhost:8080')
   ```

4. **实时更新（开发模式）**：

   在 dj-common 项目中启动 watch 模式：

   ```bash
   npm run dev
   ```

   现在修改源码会自动重新构建，测试项目会立即看到更改。

5. **取消链接**：

   测试完成后：

   ```bash
   # 在测试项目中
   npm unlink @brewer/dj-common

   # 在 dj-common 项目中
   npm unlink
   ```

### 方式二：使用 npm pack（模拟真实安装）

这种方式创建一个真实的 npm 包文件，完全模拟用户安装的情况。

#### 步骤：

1. **打包项目**：

   ```bash
   # 在 dj-common 根目录
   npm run build
   npm pack
   ```

   这会生成一个 `.tgz` 文件，如 `brewer-dj-common-1.1.0.tgz`

2. **在测试项目中安装**：

   ```bash
   # 在测试项目目录
   npm install /path/to/brewer-dj-common-1.1.0.tgz
   ```

   或者使用相对路径：

   ```bash
   npm install ../dj-common/brewer-dj-common-1.1.0.tgz
   ```

3. **测试使用**：

   ```typescript
   import { WebSocketClient } from '@brewer/dj-common'
   // 正常使用
   ```

4. **更新测试**：

   每次修改后需要重新打包和安装：

   ```bash
   # 在 dj-common 项目
   npm run build && npm pack

   # 在测试项目
   npm install /path/to/brewer-dj-common-1.1.0.tgz --force
   ```

### 方式三：直接引用 dist 文件（快速测试）

适合快速验证构建产物是否正确。

#### 步骤：

1. **构建项目**：

   ```bash
   npm run build
   ```

2. **在测试文件中直接引用**：

   ```typescript
   // ESM
   import { WebSocketClient } from '../dj-common/dist/index.esm.js'

   // CommonJS
   const { WebSocketClient } = require('../dj-common/dist/index.cjs.js')
   ```

### 方式四：创建测试项目（完整测试）

在 dj-common 项目中创建一个 examples 目录进行测试。

#### 步骤：

1. **创建测试目录**：

   ```bash
   mkdir -p examples/test-app
   cd examples/test-app
   ```

2. **初始化项目**：

   ```bash
   npm init -y
   npm install typescript ts-node @types/node --save-dev
   ```

3. **创建测试文件** `examples/test-app/index.ts`：

   ```typescript
   import { WebSocketClient } from '../../dist/index.esm.js'

   console.log('Testing WebSocketClient...')

   const client = new WebSocketClient({
     heartbeatInterval: 30000,
     maxReconnectAttempts: 5,
     autoReconnect: true,
   })

   client.on('test-message', (data) => {
     console.log('Received:', data)
   })

   // 测试连接（需要有可用的 WebSocket 服务器）
   // client.connect('ws://localhost:8080')

   console.log('✓ WebSocketClient initialized successfully')
   ```

4. **运行测试**：

   ```bash
   npx ts-node index.ts
   ```

## 测试清单

在发布前，建议测试以下内容：

### 基础功能测试

- [ ] 包能否正确导入
- [ ] 类型定义是否可用
- [ ] ESM 格式是否正常工作
- [ ] CommonJS 格式是否正常工作

### WebSocketClient 测试

- [ ] 创建实例
- [ ] 连接 WebSocket 服务器
- [ ] 发送消息
- [ ] 接收消息
- [ ] 断线重连
- [ ] 心跳机制
- [ ] 清理资源

### 兼容性测试

- [ ] Node.js 环境
- [ ] 浏览器环境（如果支持）
- [ ] TypeScript 项目
- [ ] JavaScript 项目

## 自动化测试（推荐添加）

### 添加单元测试

1. **安装测试框架**：

   ```bash
   npm install --save-dev vitest @vitest/ui
   ```

2. **创建测试文件** `src/__tests__/WebSocketClient.test.ts`：

   ```typescript
   import { describe, it, expect } from 'vitest'
   import { WebSocketClient } from '../WebSocketClient'

   describe('WebSocketClient', () => {
     it('should create instance with default config', () => {
       const client = new WebSocketClient()
       expect(client).toBeDefined()
     })

     it('should accept custom config', () => {
       const client = new WebSocketClient({
         heartbeatInterval: 60000,
         maxReconnectAttempts: 3,
       })
       expect(client).toBeDefined()
     })
   })
   ```

3. **添加测试脚本** 到 `package.json`：

   ```json
   {
     "scripts": {
       "test": "vitest",
       "test:ui": "vitest --ui",
       "test:coverage": "vitest --coverage"
     }
   }
   ```

4. **运行测试**：

   ```bash
   npm test
   ```

## 调试技巧

### 1. 查看构建产物

```bash
# 查看 ESM 版本
cat dist/index.esm.js

# 查看 CommonJS 版本
cat dist/index.cjs.js

# 查看类型定义
cat dist/index.d.ts
```

### 2. 验证包内容

```bash
# 查看将要发布的文件
npm pack --dry-run

# 实际打包并查看内容
npm pack
tar -tzf brewer-dj-common-1.1.0.tgz
```

### 3. 检查导出

```bash
# 在 Node.js 中测试
node -e "console.log(require('./dist/index.cjs.js'))"

# 在支持 ESM 的环境中测试
node --input-type=module -e "import('./dist/index.esm.js').then(m => console.log(m))"
```

## 常见问题

### Q: npm link 后找不到模块？

A: 确保：

1. 已经运行 `npm run build`
2. package.json 中的 main/module/exports 配置正确
3. 尝试 `npm unlink` 后重新 `npm link`

### Q: 类型定义不工作？

A: 检查：

1. tsconfig.json 配置
2. package.json 中的 types 字段
3. dist/index.d.ts 是否正确生成

### Q: 修改代码后没有更新？

A: 使用 `npm run dev` 启动 watch 模式，或手动重新构建。

## 推荐的测试流程

1. **开发时**：使用 `npm link` + `npm run dev`
2. **发布前**：使用 `npm pack` 进行完整测试
3. **生产环境**：使用 `npm publish` 发布后测试

## 下一步

测试完成后，可以：

1. 提交代码：`git add . && git commit -m "test: add local testing"`
2. 发布版本：告诉 Claude "发布新版本"
3. 验证发布：`npm view @brewer/dj-common`
