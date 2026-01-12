import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import babel from '@rollup/plugin-babel'
import terser from '@rollup/plugin-terser'
import { readdirSync, statSync, existsSync, rmSync } from 'fs'
import { join, basename, extname, resolve as pathResolve } from 'path'

/**
 * 自动扫描 src 目录下的所有 .js 文件（排除 index.js）
 * 自动生成构建配置
 */
function scanModules() {
  const srcDir = './src'
  const files = readdirSync(srcDir)
  const modules = []

  files.forEach((file) => {
    const filePath = join(srcDir, file)
    const stat = statSync(filePath)

    // 只处理 .js 文件，排除 index.js
    if (stat.isFile() && extname(file) === '.js' && file !== 'index.js') {
      const moduleName = basename(file, '.js')
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
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              browsers: ['> 1%', 'last 2 versions', 'not dead'],
            },
          },
        ],
      ],
    }),
    terser(),
  ].filter(Boolean),
})

// 自动扫描模块并生成配置
const modules = scanModules()
const configs = [
  // 主入口文件（第一个构建，执行清理）
  createConfig('src/index.js', 'index', true),
  // 自动扫描的其他模块
  ...modules.map((module) => createConfig(module.input, module.name)),
]

console.log(`\n📦 检测到 ${modules.length + 1} 个模块需要构建:`)
console.log('  - index.js (主入口)')
modules.forEach((module) => console.log(`  - ${module.name}.js`))
console.log('')

export default configs
