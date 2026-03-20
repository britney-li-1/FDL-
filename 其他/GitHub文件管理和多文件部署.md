# 📁 GitHub 文件管理和多文件部署

## 🔍 如何在 GitHub 查看和编辑文件

### 1. 查看文件

**步骤：**
1. 访问：https://github.com/britney-li-1/FDL-
2. 在仓库页面，你会看到所有文件和文件夹
3. 点击文件名，可以查看文件内容
4. 点击文件夹，可以进入文件夹查看

**示例：**
- 点击 `index.html` → 查看主页文件
- 点击 `定时管道优化/` → 进入文件夹
- 点击 `定时管道优化/字段映射批量操作.html` → 查看该文件

---

### 2. 在线编辑文件

**步骤：**
1. 点击要编辑的文件
2. 点击右上角的 **✏️ Edit**（编辑）按钮（铅笔图标）
3. 在编辑器中修改内容
4. 滚动到页面底部，填写：
   - **Commit message**：描述你的修改，如 "更新页面内容"
   - 选择 **Commit directly to the main branch**
5. 点击 **Commit changes**（提交更改）

**注意：**
- 修改后，GitHub Pages 会自动更新（1-2 分钟）
- 不需要手动推送，GitHub 会自动处理

---

### 3. 删除文件

**步骤：**
1. 点击要删除的文件
2. 点击右上角的 **🗑️ Delete**（删除）按钮（垃圾桶图标）
3. 填写提交信息
4. 点击 **Commit changes**

---

### 4. 上传新文件

**步骤：**
1. 在仓库页面，点击 **Add file** → **Upload files**
2. 拖拽文件或点击选择文件
3. 填写提交信息
4. 点击 **Commit changes**

---

## 📦 将多个文件部署到同一个仓库

### ✅ 可以！完全可以！

你可以将多个 HTML 文件放在同一个仓库中，每个文件都有自己的访问地址。

---

## 🎯 多文件部署方案

### 方案一：每个文件独立访问（推荐）

**文件结构：**
```
FDL-/
├── index.html                    → https://britney-li-1.github.io/FDL-/
├── 定时管道优化/
│   ├── 字段映射批量操作.html      → https://britney-li-1.github.io/FDL-/定时管道优化/字段映射批量操作.html
│   ├── 定时管道-新建页.html        → https://britney-li-1.github.io/FDL-/定时管道优化/定时管道-新建页.html
│   └── 新建页添加表弹窗.html       → https://britney-li-1.github.io/FDL-/定时管道优化/新建页添加表弹窗.html
├── 实时管道相关优化/
│   └── 数据一致性.html            → https://britney-li-1.github.io/FDL-/实时管道相关优化/数据一致性.html
└── 检测任务相关优化/
    └── 检测对象展示方案比对.html  → https://britney-li-1.github.io/FDL-/检测任务相关优化/检测对象展示方案比对.html
```

**访问地址规则：**
```
https://britney-li-1.github.io/FDL-/文件路径
```

**示例：**
- `定时管道优化/字段映射批量操作.html` 
  → `https://britney-li-1.github.io/FDL-/定时管道优化/字段映射批量操作.html`

---

### 方案二：创建多个 index.html（不推荐）

如果你想每个文件夹都有主页，可以：
- 在每个文件夹创建 `index.html`
- 但这样会覆盖根目录的 `index.html`

---

## 🚀 如何添加更多文件到仓库

### 方法一：通过 GitHub 网页上传

**步骤：**
1. 访问：https://github.com/britney-li-1/FDL-
2. 点击 **Add file** → **Upload files**
3. 选择要上传的文件
4. 可以拖拽到指定文件夹
5. 填写提交信息
6. 点击 **Commit changes**

**优点：**
- 简单直接
- 不需要使用 Git 命令

---

### 方法二：通过本地 Git 推送

**步骤：**
1. 将文件复制到项目目录
2. 在终端执行：
   ```bash
   cd "/Users/qiushengming/Desktop/李慧雯设计素材/cursor test"
   git add .
   git commit -m "添加新页面"
   git push
   ```

**优点：**
- 可以批量添加多个文件
- 适合大量文件

---

## 📝 实际示例：添加你的其他 HTML 文件

你已经有的文件：
- `定时管道优化/定时管道-新建页.html`
- `定时管道优化/新建页添加表弹窗.html`
- `实时管道相关优化/数据一致性.html`
- `检测任务相关优化/检测对象展示方案比对.html`

**这些文件已经在仓库中了！** 可以直接通过以下地址访问：

```
https://britney-li-1.github.io/FDL-/定时管道优化/定时管道-新建页.html
https://britney-li-1.github.io/FDL-/定时管道优化/新建页添加表弹窗.html
https://britney-li-1.github.io/FDL-/实时管道相关优化/数据一致性.html
https://britney-li-1.github.io/FDL-/检测任务相关优化/检测对象展示方案比对.html
```

---

## 🎨 创建导航页面（可选）

你可以创建一个导航页面，链接到所有页面：

**创建 `导航.html`：**
```html
<!DOCTYPE html>
<html>
<head>
    <title>页面导航</title>
</head>
<body>
    <h1>我的页面导航</h1>
    <ul>
        <li><a href="index.html">字段映射批量操作</a></li>
        <li><a href="定时管道优化/定时管道-新建页.html">定时管道-新建页</a></li>
        <li><a href="定时管道优化/新建页添加表弹窗.html">新建页添加表弹窗</a></li>
        <li><a href="实时管道相关优化/数据一致性.html">数据一致性</a></li>
        <li><a href="检测任务相关优化/检测对象展示方案比对.html">检测对象展示方案比对</a></li>
    </ul>
</body>
</html>
```

然后访问：`https://britney-li-1.github.io/FDL-/导航.html`

---

## ✅ 总结

1. **查看文件**：在仓库页面点击文件名
2. **编辑文件**：点击文件 → 点击编辑按钮 → 修改 → 提交
3. **多文件部署**：✅ 可以，所有文件都在同一个仓库
4. **访问地址**：`https://britney-li-1.github.io/FDL-/文件路径`
5. **自动更新**：修改后 1-2 分钟自动更新

你的所有 HTML 文件都可以部署到同一个仓库，每个都有自己的访问地址！








