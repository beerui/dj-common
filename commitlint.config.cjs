module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修复 bug
        'docs',     // 文档更新
        'style',    // 代码格式（不影响代码运行的变动）
        'refactor', // 重构（既不是新增功能，也不是修复 bug）
        'perf',     // 性能优化
        'test',     // 增加测试
        'build',    // 构建过程或辅助工具的变动
        'ci',       // CI 配置文件和脚本的变动
        'chore',    // 其他不修改 src 或 test 的变动
        'revert',   // 回退
      ],
    ],
    'subject-case': [0], // 不限制主题大小写
    'body-max-line-length': [0],
    // 不限制subject长度
    'subject-max-length': [0],
    // 不限制body长度
    'body-max-length': [0],
    // 不限制footer长度
    'footer-max-line-length': [0],
    // 不限制header长度
    'header-max-length': [0],
  },
}
