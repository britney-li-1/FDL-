#!/bin/bash

# 自动生成导航页面脚本
# 使用方法：./生成导航页面.sh

NAV_FILE="导航.html"
TEMP_FILE=$(mktemp)

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔍 正在扫描 HTML 文件..."

# 生成导航页面 HTML 头部
cat > "$TEMP_FILE" << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>页面导航 - FDL 设计素材</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 40px 20px;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            color: #fff;
            margin-bottom: 50px;
        }

        .header h1 {
            font-size: 42px;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }

        .header p {
            font-size: 18px;
            opacity: 0.9;
        }

        .section {
            background: #fff;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        .section-title {
            font-size: 24px;
            font-weight: 600;
            color: #667eea;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f0f0;
            display: flex;
            align-items: center;
        }

        .section-title::before {
            content: "📁";
            margin-right: 10px;
            font-size: 28px;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 15px;
        }

        .card {
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            transition: all 0.3s ease;
            cursor: pointer;
            text-decoration: none;
            color: inherit;
            display: block;
        }

        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
            border-color: #667eea;
            background: #fff;
        }

        .card-title {
            font-size: 16px;
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
        }

        .card-title::before {
            content: "🔗";
            margin-right: 8px;
            font-size: 18px;
        }

        .card-path {
            font-size: 13px;
            color: #666;
            font-family: 'Courier New', monospace;
            word-break: break-all;
        }

        .footer {
            text-align: center;
            color: #fff;
            margin-top: 50px;
            opacity: 0.8;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 32px;
            }
            
            .grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 FDL 设计素材导航</h1>
            <p>快速访问所有页面</p>
        </div>
EOF

# 创建临时文件存储分类
ROOT_TEMP=$(mktemp)
CATEGORY_TEMP=$(mktemp)

# 扫描所有 HTML 文件（排除导航.html）
find . -name "*.html" -type f | sed 's|^\./||' | grep -v "^导航\.html$" | sort | while IFS= read -r file; do
    # 获取目录路径
    dir=$(dirname "$file")
    
    if [ "$dir" = "." ]; then
        # 根目录文件
        echo "$file" >> "$ROOT_TEMP"
    else
        # 子目录文件，格式：目录|文件
        echo "$dir|$file" >> "$CATEGORY_TEMP"
    fi
done

# 生成根目录文件部分
if [ -s "$ROOT_TEMP" ]; then
    echo '        <!-- 主页 -->' >> "$TEMP_FILE"
    echo '        <div class="section">' >> "$TEMP_FILE"
    echo '            <div class="section-title">🏠 主页</div>' >> "$TEMP_FILE"
    echo '            <div class="grid">' >> "$TEMP_FILE"
    
    while IFS= read -r file; do
        filename=$(basename "$file" .html)
        echo "                <a href=\"$file\" class=\"card\">" >> "$TEMP_FILE"
        echo "                    <div class=\"card-title\">$filename</div>" >> "$TEMP_FILE"
        echo "                    <div class=\"card-path\">$file</div>" >> "$TEMP_FILE"
        echo "                </a>" >> "$TEMP_FILE"
    done < "$ROOT_TEMP"
    
    echo '            </div>' >> "$TEMP_FILE"
    echo '        </div>' >> "$TEMP_FILE"
fi

# 生成分类部分
if [ -s "$CATEGORY_TEMP" ]; then
    # 获取所有唯一的目录
    cut -d'|' -f1 "$CATEGORY_TEMP" | sort -u | while IFS= read -r category; do
        # 获取分类显示名称和图标
        case "$category" in
            "定时管道优化")
                icon="⏰"
                name="定时管道优化"
                ;;
            "实时管道相关优化")
                icon="⚡"
                name="实时管道相关优化"
                ;;
            "检测任务相关优化 "*)
                icon="🔍"
                name="检测任务相关优化"
                ;;
            *)
                icon="📂"
                name="$category"
                ;;
        esac
        
        echo "        <!-- $name -->" >> "$TEMP_FILE"
        echo '        <div class="section">' >> "$TEMP_FILE"
        echo "            <div class=\"section-title\">$icon $name</div>" >> "$TEMP_FILE"
        echo '            <div class="grid">' >> "$TEMP_FILE"
        
        # 获取该分类下的所有文件
        grep "^$category|" "$CATEGORY_TEMP" | cut -d'|' -f2 | while IFS= read -r file; do
            filename=$(basename "$file" .html)
            echo "                <a href=\"$file\" class=\"card\">" >> "$TEMP_FILE"
            echo "                    <div class=\"card-title\">$filename</div>" >> "$TEMP_FILE"
            echo "                    <div class=\"card-path\">$file</div>" >> "$TEMP_FILE"
            echo "                </a>" >> "$TEMP_FILE"
        done
        
        echo '            </div>' >> "$TEMP_FILE"
        echo '        </div>' >> "$TEMP_FILE"
    done
fi

# 清理临时文件
rm -f "$ROOT_TEMP" "$CATEGORY_TEMP"

# 添加页脚
cat >> "$TEMP_FILE" << EOF
        <div class="footer">
            <p>© 2024 FDL 设计素材 | GitHub Pages</p>
            <p style="font-size: 12px; margin-top: 10px;">自动生成于 $(date '+%Y-%m-%d %H:%M:%S')</p>
        </div>
    </div>
</body>
</html>
EOF

# 替换文件
mv "$TEMP_FILE" "$NAV_FILE"

# 统计
root_count=$(find . -maxdepth 1 -name "*.html" -type f | grep -v "^\./导航\.html$" | wc -l | tr -d ' ')
category_count=$(find . -mindepth 2 -name "*.html" -type f | cut -d'/' -f2 | sort -u | wc -l | tr -d ' ')

echo "✅ 导航页面已生成：$NAV_FILE"
echo ""
echo "📊 统计："
echo "   - 根目录文件：$root_count 个"
echo "   - 分类目录：$category_count 个"
echo ""
echo "💡 提示：运行此脚本后，记得提交并推送导航页面："
echo "   git add 导航.html"
echo "   git commit -m '更新导航页面'"
echo "   git push"
