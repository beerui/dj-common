# dj-common 测试示例

这是一个简单的测试项目，用于验证 dj-common 包是否正常工作。

## 运行测试

在项目根目录（dj-common）执行：

```bash
# 1. 构建项目
npm run build

# 2. 运行测试
node examples/basic-test/index.js
```

## 测试内容

- ✅ 创建 WebSocketClient 实例
- ✅ 注册消息回调
- ✅ 检查模块导出

## 使用 npm link 测试

如果想在其他项目中测试：

```bash
# 在 dj-common 根目录
npm link

# 在其他项目中
npm link @brewer/dj-common
```

然后就可以像正常安装的包一样使用了：

```javascript
import { WebSocketClient } from '@brewer/dj-common'
```
