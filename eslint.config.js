import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'

export default [
  // 全局忽略文件
  {
    ignores: ['node_modules/**', 'dist/**', 'examples/**'],
  },

  // JavaScript/TypeScript 通用配置
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    ignores: ['**/*.config.{js,mjs,cjs}'], // 忽略配置文件
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        // 浏览器环境
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        // Node.js 环境
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'writable',
        global: 'readonly',
        // ES2021
        console: 'readonly',
        // 定时器相关（浏览器和 Node.js 都有）
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      prettier: prettier,
    },
    rules: {
      // ESLint 推荐规则
      ...js.configs.recommended.rules,
      // TypeScript 推荐规则
      ...typescript.configs.recommended.rules,
      // Prettier 配置
      ...prettierConfig.rules,

      // 自定义规则
      'no-console': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'prettier/prettier': 'warn',
    },
  },

  // .js 和 .cjs 文件特殊配置
  {
    files: ['**/*.{js,cjs}'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
]
