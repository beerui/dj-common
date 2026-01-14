import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import { readdirSync, statSync, existsSync, rmSync, readFileSync } from 'fs'
import { join, basename, extname, resolve as pathResolve } from 'path'
import ts from 'typescript'

/**
 * Rollup 插件：内联 Worker 代码
 * 将 worker-script.ts 编译后的代码内联到 SharedWorkerManager.ts 中
 */
function inlineWorkerPlugin() {
  let workerCode = null

  return {
    name: 'inline-worker',
    buildStart() {
      // 读取 worker-script.ts 源代码
      try {
        const workerSourcePath = pathResolve('src/worker-script.ts')
        const workerSource = readFileSync(workerSourcePath, 'utf-8')
        console.log('✓ 已读取 Worker 源代码')

        // 使用 TypeScript 编译器编译 Worker 代码为纯 JavaScript
        const compileOptions = {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.None, // 不使用模块系统
          removeComments: true, // 移除注释
          downlevelIteration: true,
          strict: false,
        }

        const result = ts.transpileModule(workerSource, {
          compilerOptions: compileOptions,
        })

        workerCode = result.outputText
        console.log(`✓ Worker 代码已编译为 JavaScript (${workerCode.length} 字符)`)
      } catch (error) {
        console.error('✗ 编译 Worker 代码失败:', error)
        workerCode = null
      }
    },
    transform(code, id) {
      // 只处理 SharedWorkerManager.ts
      if (id.includes('SharedWorkerManager') && workerCode) {
        // 转义 Worker 代码
        const escapedCode = workerCode
          .replace(/\\/g, '\\\\')
          .replace(/`/g, '\\`')
          .replace(/\$/g, '\\$')
          .replace(/\r?\n/g, '\\n')

        // 替换占位符
        const transformedCode = code.replace("'__WORKER_SCRIPT_CONTENT__'", `\`${escapedCode}\``)

        if (transformedCode !== code) {
          console.log('✓ Worker 代码已内联到 SharedWorkerManager')
        }

        return {
          code: transformedCode,
          map: null,
        }
      }

      return null
    },
  }
}

/**
 * 自动扫描 src 目录下的所有 .ts 文件（排除 index.ts 和 .d.ts）
 * 自动生成构建配置
 */
function scanModules() {
  const srcDir = './src'
  const files = readdirSync(srcDir)
  const modules = []

  files.forEach((file) => {
    const filePath = join(srcDir, file)
    const stat = statSync(filePath)

    // 只处理 .ts 文件，排除 index.ts 和 .d.ts 文件
    if (stat.isFile() && extname(file) === '.ts' && file !== 'index.ts' && !file.endsWith('.d.ts')) {
      const moduleName = basename(file, '.ts')
      modules.push({
        input: filePath,
        name: moduleName,
      })
    }
  })

  return modules
}

const createConfig = (input, outputName, isFirstBuild = false) => ({
  input,
  output: [
    {
      file: `dist/${outputName}.esm.js`,
      format: 'esm',
      sourcemap: true,
    },
    {
      file: `dist/${outputName}.cjs.js`,
      format: 'cjs',
      sourcemap: true,
      exports: 'auto',
    },
  ],
  plugins: [
    // 只在第一次构建时清理 dist 目录
    isFirstBuild && {
      name: 'clean-dist',
      buildStart() {
        const distPath = pathResolve('dist')
        if (existsSync(distPath)) {
          rmSync(distPath, { recursive: true, force: true })
          console.log('✓ 已清理 dist 目录')
        }
      },
    },
    // 内联 Worker 代码插件
    inlineWorkerPlugin(),
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: './dist',
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
    }),
    terser(),
  ].filter(Boolean),
})

// 自动扫描模块并生成配置
const modules = scanModules()
const configs = [
  // 主入口文件（第一个构建，执行清理）
  createConfig('src/index.ts', 'index', true),
  // 自动扫描的其他模块
  ...modules.map((module) => createConfig(module.input, module.name)),
]

console.log(`\n📦 检测到 ${modules.length + 1} 个模块需要构建:`)
console.log('  - index.ts (主入口)')
modules.forEach((module) => console.log(`  - ${module.name}.ts`))
console.log('')

export default configs
