# 🔑 使用 Token 推送代码

## 方法一：推送时输入 Token（最简单）

### 步骤：

1. **打开终端（Terminal）**

2. **执行以下命令**：
   ```bash
   cd "/Users/qiushengming/Desktop/李慧雯设计素材/cursor test"
   git push -u origin main
   ```

3. **当终端提示时**：
   
   **提示 1：`Username for 'https://github.com':`**
   - 输入：`britney-li-1`
   - 按回车
   
   **提示 2：`Password for 'https://britney-li-1@github.com':`**
   - ⚠️ **重要**：这里不是输入登录密码
   - 而是**粘贴你刚才复制的 token**
   - 粘贴后按回车（终端不会显示输入内容，这是正常的）

4. **等待推送完成**

---

## 方法二：在命令中直接使用 Token（一次性）

如果你不想每次输入，可以临时修改远程地址：

```bash
cd "/Users/qiushengming/Desktop/李慧雯设计素材/cursor test"

# 将 YOUR_TOKEN 替换为你复制的实际 token
git remote set-url origin https://YOUR_TOKEN@github.com/britney-li-1/FDL-.git

# 推送
git push -u origin main
```

**示例**（假设你的 token 是 `ghp_xxxxxxxxxxxxx`）：
```bash
git remote set-url origin https://ghp_xxxxxxxxxxxxx@github.com/britney-li-1/FDL-.git
git push -u origin main
```

**⚠️ 注意**：推送完成后，建议恢复原始地址：
```bash
git remote set-url origin https://github.com/britney-li-1/FDL-.git
```

---

## ✅ 推送成功的标志

你会看到类似这样的输出：
```
Enumerating objects: 19, done.
Counting objects: 100% (19/19), done.
Writing objects: 100% (19/19), done.
To https://github.com/britney-li-1/FDL-.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

---

## 🎯 推荐使用方法一

方法一更安全，token 不会出现在命令历史中。








