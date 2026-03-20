# 通过下载 Zip 获取 ff-webui 仓库

## 方式一：在浏览器里下载（推荐）

1. **登录**  
   打开：<https://code.fineres.com>  
   用你的账号登录。

2. **打开仓库**  
   访问：<https://code.fineres.com/users/britney.li/repos/ff-webui/browse>

3. **下载为 Zip**  
   - 在仓库页面左侧或右上角找到 **「Clone」** 或 **「下载」**  
   - 选择 **「Download repository」** 或 **「下载为 Zip」**  
   - 保存到电脑（例如桌面或当前项目目录）。

4. **解压到当前项目**  
   - 解压下载的 zip 到本目录（`ff_webui`）  
   - 如果解压出来是带一层 `ff-webui-xxx` 的文件夹，可以：
     - 把里面的所有文件/文件夹移到 `ff_webui` 根目录，或  
     - 直接在该文件夹里开发，保持现有结构即可。

---

## 方式二：用脚本下载（需填写账号）

如果你有 Bitbucket 的**用户名**和 **App Password / Token**，可以：

1. 复制 `download-ff-webui.sh` 到本目录（若已存在则跳过）。
2. 编辑脚本，把里面的 `你的用户名` 和 `你的AppPassword或Token` 改成你的凭证。
3. 在终端执行：
   ```bash
   cd "/Users/qiushengming/Desktop/李慧雯设计素材/cursor test/ff_webui"
   chmod +x download-ff-webui.sh
   ./download-ff-webui.sh
   ```
4. 脚本会下载 zip 并解压到当前目录的 `ff-webui-repo` 文件夹。

---

下载并解压完成后，就可以在本地按正常前端项目的方式打开、安装依赖、运行。
