#!/bin/bash

# 发布脚本 - 自动化 npm 包发布流程

set -e

echo "🚀 开始发布流程..."
echo ""

# 1. 检查是否在 git 仓库中
if [ ! -d ".git" ]; then
  echo "❌ 错误: 当前目录不是 git 仓库"
  exit 1
fi

# 2. 检查是否有未提交的更改
if [[ -n $(git status -s) ]]; then
  echo "❌ 错误: 有未提交的更改，请先提交或暂存"
  git status -s
  exit 1
fi

# 3. 确保在主分支
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
  echo "⚠️  警告: 当前不在 main/master 分支"
  read -p "是否继续? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 4. 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin $CURRENT_BRANCH || true
echo ""

# 5. 运行代码检查
echo "🔍 运行代码检查..."
npm run lint
echo ""

# 6. 运行构建
echo "📦 构建项目..."
npm run build
echo ""

# 7. 选择版本类型
echo "请选择版本更新类型:"
echo "  1) patch (bug 修复) - 1.0.0 -> 1.0.1"
echo "  2) minor (新功能)   - 1.0.0 -> 1.1.0"
echo "  3) major (破坏性更新) - 1.0.0 -> 2.0.0"
echo "  4) custom (自定义)"
echo ""
read -p "请输入选项 (1-4): " version_type

case $version_type in
  1)
    npm run release:patch
    ;;
  2)
    npm run release:minor
    ;;
  3)
    npm run release:major
    ;;
  4)
    read -p "请输入版本号 (如 1.2.3): " custom_version
    npm run release -- --release-as $custom_version
    ;;
  *)
    echo "❌ 无效的选项"
    exit 1
    ;;
esac

echo ""

# 8. 推送到远程仓库
echo "📤 推送到远程仓库..."
git push --follow-tags origin $CURRENT_BRANCH
echo ""

# 9. 发布到 npm
read -p "是否发布到 npm? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "📦 发布到 npm..."
  npm publish
  echo ""
  echo "✅ 发布成功!"
else
  echo "⏭️  跳过 npm 发布"
fi

echo ""
echo "🎉 发布流程完成!"
