# GitHub Pages 部署保姆级教程

本教程将详细指导你如何将 HTML 文件部署到 GitHub 上，并通过 GitHub Pages 让全世界都能访问。

---

## 📋 准备工作

### 1. 注册 GitHub 账号（如果还没有）

1. 访问 https://github.com
2. 点击右上角的 **Sign up**（注册）
3. 填写用户名、邮箱和密码
4. 完成邮箱验证

### 2. 安装 Git（如果还没有）

#### macOS 系统：
- Git 通常已经预装，可以在终端输入 `git --version` 检查
- 如果没有，访问 https://git-scm.com/download/mac 下载安装

#### 验证安装：
打开终端（Terminal），输入：
```bash
git --version
```
如果显示版本号，说明已安装成功。

---

## 🚀 部署步骤

### 第一步：在 GitHub 上创建新仓库

1. **登录 GitHub**
   - 访问 https://github.com
   - 使用你的账号登录

2. **创建新仓库**
   - 点击右上角的 **+** 号
   - 选择 **New repository**（新建仓库）

3. **填写仓库信息**
   - **Repository name**（仓库名称）：输入 `my-html-project`（或任何你喜欢的名字）
   - **Description**（描述）：可选，如 "字段映射批量操作页面"
   - **Public**（公开）：✅ 选择 Public（必须选择公开才能使用免费 GitHub Pages）
   - **不要勾选** "Add a README file"（我们稍后会上传文件）
   - 点击 **Create repository**（创建仓库）

### 第二步：在本地准备文件

1. **打开终端（Terminal）**

2. **进入你的项目目录**
   ```bash
   cd "/Users/qiushengming/Desktop/李慧雯设计素材/cursor test"
   ```

3. **初始化 Git 仓库**
   ```bash
   git init
   ```

4. **将文件添加到 Git**
   ```bash
   git add "定时管道优化/字段映射批量操作.html"
   ```

5. **提交文件**
   ```bash
   git commit -m "首次提交：添加字段映射批量操作页面"
   ```

### 第三步：连接 GitHub 并上传

1. **添加远程仓库地址**
   ```bash
   git remote add origin https://github.com/你的用户名/my-html-project.git
   ```
   ⚠️ **重要**：将 `你的用户名` 替换为你的 GitHub 用户名，`my-html-project` 替换为你创建的仓库名

2. **将文件推送到 GitHub**
   ```bash
   git branch -M main
   git push -u origin main
   ```

3. **输入 GitHub 凭证**
   - 如果提示输入用户名和密码：
     - **用户名**：你的 GitHub 用户名
     - **密码**：需要使用 **Personal Access Token**（不是登录密码）
   
   **如何获取 Personal Access Token：**
   - 访问 https://github.com/settings/tokens
   - 点击 **Generate new token** → **Generate new token (classic)**
   - **Note**：输入 "Git 推送"（任意描述）
   - **Expiration**：选择过期时间（建议 90 天或 No expiration）
   - **勾选权限**：至少勾选 `repo`（完整仓库权限）
   - 点击 **Generate token**
   - **⚠️ 重要**：复制生成的 token（只显示一次，请保存好）
   - 在终端输入密码时，粘贴这个 token

### 第四步：启用 GitHub Pages

1. **进入仓库页面**
   - 在 GitHub 上打开你刚创建的仓库

2. **进入设置**
   - 点击仓库页面顶部的 **Settings**（设置）标签

3. **找到 Pages 设置**
   - 在左侧菜单中找到 **Pages**（页面）选项

4. **配置 Pages**
   - **Source**（来源）：选择 **Deploy from a branch**
   - **Branch**（分支）：选择 **main**，文件夹选择 **/ (root)**
   - 点击 **Save**（保存）

5. **等待部署**
   - 等待 1-2 分钟，页面会显示：
     ```
     Your site is live at https://你的用户名.github.io/my-html-project/
     ```

### 第五步：访问你的网站

1. **访问主页**
   - 访问：`https://你的用户名.github.io/my-html-project/`
   - 如果直接访问根目录，GitHub Pages 会自动查找 `index.html`

2. **访问具体文件**
   - 访问：`https://你的用户名.github.io/my-html-project/定时管道优化/字段映射批量操作.html`

---

## 🎯 优化建议：创建 index.html

为了让访问更方便，建议将主文件重命名为 `index.html` 并放在根目录：

1. **在本地创建 index.html**
   ```bash
   cp "定时管道优化/字段映射批量操作.html" index.html
   ```

2. **提交并推送**
   ```bash
   git add index.html
   git commit -m "添加 index.html 作为主页"
   git push
   ```

3. **访问**
   - 现在可以直接访问：`https://你的用户名.github.io/my-html-project/`

---

## 📝 后续更新文件

如果以后需要更新文件：

1. **修改文件后，在终端执行：**
   ```bash
   cd "/Users/qiushengming/Desktop/李慧雯设计素材/cursor test"
   git add .
   git commit -m "更新页面内容"
   git push
   ```

2. **等待 1-2 分钟**，GitHub Pages 会自动更新

---

## ❓ 常见问题

### Q1: 提示 "fatal: not a git repository"
**解决**：确保在正确的目录执行 `git init`

### Q2: 提示 "remote origin already exists"
**解决**：执行 `git remote remove origin`，然后重新添加

### Q3: 推送时提示认证失败
**解决**：
- 确保使用 Personal Access Token 而不是密码
- 检查 token 是否过期
- 重新生成 token 并重试

### Q4: 网站显示 404
**解决**：
- 等待几分钟（首次部署需要时间）
- 检查文件路径是否正确
- 确保仓库是 Public（公开）

### Q5: 中文文件名显示乱码
**解决**：
- 建议使用英文文件名，如 `field-mapping.html`
- 或确保 Git 配置正确：`git config --global core.quotepath false`

---

## 🎉 完成！

现在你的 HTML 页面已经部署到 GitHub Pages 上了！你可以：
- 分享链接给任何人
- 在任何设备上访问
- 随时更新内容

---

## 📚 快速命令参考

```bash
# 1. 进入项目目录
cd "/Users/qiushengming/Desktop/李慧雯设计素材/cursor test"

# 2. 初始化 Git（只需执行一次）
git init

# 3. 添加文件
git add .

# 4. 提交
git commit -m "描述你的更改"

# 5. 连接远程仓库（只需执行一次）
git remote add origin https://github.com/你的用户名/仓库名.git

# 6. 推送
git push -u origin main

# 后续更新只需执行 3、4、6 步
```

---

**需要帮助？** 如果遇到任何问题，请告诉我具体的错误信息！

