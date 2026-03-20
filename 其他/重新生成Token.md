# 🔑 重新生成 Personal Access Token

## 步骤：

### 1. 访问 Token 设置页面
- 打开浏览器，访问：https://github.com/settings/tokens
- 或者：
  1. 访问 https://github.com
  2. 点击右上角头像
  3. 选择 **Settings**（设置）
  4. 在左侧菜单中找到 **Developer settings**（开发者设置）
  5. 点击 **Personal access tokens** → **Tokens (classic)**

### 2. 生成新 Token
1. 点击 **Generate new token**（生成新令牌）
2. 选择 **Generate new token (classic)**（生成经典令牌）

### 3. 配置 Token
- **Note**（备注）：输入描述，如 "Git 推送 - 2024"
- **Expiration**（过期时间）：
  - 选择 **90 days**（90天）
  - 或 **No expiration**（永不过期）- 如果选择这个，请务必保存好 token
- **Select scopes**（选择权限）：
  - ✅ **必须勾选 `repo`**（完整仓库权限）
  - 这会自动勾选所有 repo 相关的子权限

### 4. 生成并复制 Token
1. 滚动到页面底部
2. 点击 **Generate token**（生成令牌）
3. ⚠️ **重要**：立即复制生成的 token
   - Token 只显示一次！
   - 格式类似：`ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - 如果关闭页面，就再也看不到了

### 5. 保存 Token
- 将 token 保存在安全的地方
- 建议保存在：
  - 密码管理器
  - 或文本文件（但要保护好）

---

## 📝 使用 Token 推送

生成 token 后，在终端执行：

```bash
cd "/Users/qiushengming/Desktop/李慧雯设计素材/cursor test"
git push
```

然后：
- **Username**: `britney-li-1`
- **Password**: 粘贴新生成的 token

---

## 💡 提示

- 如果网络连接有问题，可以稍后重试
- Token 生成后立即使用，避免丢失
- 如果 token 丢失，只能重新生成

---

## 🔄 如果之前有旧 Token

如果之前生成过 token 但现在找不到了：
1. 可以继续使用旧 token（如果还没过期）
2. 或者生成新 token 替换旧的
3. 旧 token 不会自动失效，除非你手动删除








