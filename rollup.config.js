import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import { readdirSync, statSync, existsSync, rmSync } from 'fs'
import { join, basename, extname, resolve as pathResolve } from 'path'

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
