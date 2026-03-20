#!/bin/bash

# GitHub 部署脚本
# 使用方法：在终端执行 ./deploy.sh

echo "🚀 开始部署到 GitHub..."
echo ""

# 检查是否在正确的目录
if [ ! -f "定时管道优化/字段映射批量操作.html" ]; then
    echo "❌ 错误：找不到 HTML 文件"
    echo "请确保在项目根目录执行此脚本"
    exit 1
fi

# 检查 Git 是否已初始化
if [ ! -d ".git" ]; then
    echo "📦 初始化 Git 仓库..."
    git init
fi

# 添加文件
echo "📝 添加文件到 Git..."
git add .

# 提交
echo "💾 提交更改..."
read -p "请输入提交信息（直接回车使用默认信息）: " commit_msg
if [ -z "$commit_msg" ]; then
    commit_msg="更新页面内容"
fi
git commit -m "$commit_msg"

# 检查是否已设置远程仓库
if ! git remote | grep -q "origin"; then
    echo ""
    echo "⚠️  检测到尚未设置远程仓库"
    echo "请先在 GitHub 上创建仓库，然后执行以下命令："
    echo ""
    echo "git remote add origin https://github.com/你的用户名/仓库名.git"
    echo "git branch -M main"
    echo "git push -u origin main"
    echo ""
    read -p "是否已创建仓库并设置远程地址？(y/n): " has_remote
    if [ "$has_remote" != "y" ]; then
        echo "请先完成 GitHub 仓库创建，然后重新运行此脚本"
        exit 1
    fi
fi

# 推送
echo "📤 推送到 GitHub..."
git push

echo ""
echo "✅ 部署完成！"
echo ""
echo "📌 下一步："
echo "1. 访问你的 GitHub 仓库"
echo "2. 进入 Settings → Pages"
echo "3. 选择 Source: Deploy from a branch"
echo "4. 选择 Branch: main, Folder: / (root)"
echo "5. 等待 1-2 分钟，访问你的网站"
echo ""

