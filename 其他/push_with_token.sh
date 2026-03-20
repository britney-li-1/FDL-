#!/bin/bash

# 使用 Token 推送脚本
# 使用方法：./push_with_token.sh YOUR_TOKEN

TOKEN=$1

if [ -z "$TOKEN" ]; then
    echo "❌ 错误：请提供 token"
    echo ""
    echo "使用方法："
    echo "  ./push_with_token.sh YOUR_TOKEN"
    echo ""
    echo "或者直接在终端执行："
    echo "  cd \"$(pwd)\""
    echo "  git push"
    echo "  然后按提示输入用户名和 token"
    exit 1
fi

echo "🚀 开始推送..."
echo ""

# 临时设置远程地址（包含token）
git remote set-url origin https://${TOKEN}@github.com/britney-li-1/FDL-.git

# 推送
echo "📤 推送到 GitHub..."
git push -u origin main

# 恢复原始地址（不包含token）
echo ""
echo "🔒 恢复原始远程地址..."
git remote set-url origin https://github.com/britney-li-1/FDL-.git

echo ""
echo "✅ 推送完成！"
echo ""
echo "📌 等待 1-2 分钟后，访问你的网站："
echo "   https://britney-li-1.github.io/FDL-/"
echo ""







