#!/bin/bash
# 从 code.fineres.com 下载 ff-webui 仓库 zip 并解压到当前目录
# 使用前请把下面两行改成你的 Bitbucket 用户名和 App Password（或 Token）
USER="你的用户名"
PASS="你的AppPassword或Token"

BASE="https://code.fineres.com"
ARCHIVE_URL="${BASE}/rest/api/latest/users/britney.li/repos/ff-webui/archive?format=zip"
ZIP_FILE="ff-webui-archive.zip"
OUT_DIR="ff-webui-repo"

if [[ "$USER" == "你的用户名" ]] || [[ "$PASS" == "你的AppPassword或Token" ]]; then
  echo "请先编辑本脚本，填写 USER 和 PASS（Bitbucket 用户名和 App Password）"
  exit 1
fi

echo "正在下载 ff-webui 仓库..."
if curl -sL -u "${USER}:${PASS}" -o "$ZIP_FILE" "$ARCHIVE_URL"; then
  if [[ -f "$ZIP_FILE" ]] && [[ -s "$ZIP_FILE" ]]; then
    echo "下载完成，正在解压..."
    rm -rf "$OUT_DIR"
    unzip -q -o "$ZIP_FILE" -d .
    # Bitbucket 解压后可能是 ff-webui 或 ff-webui-xxx 等，统一移到 OUT_DIR
    for d in ff-webui ff-webui-*; do
      [[ -d "$d" ]] && [[ "$d" != "$OUT_DIR" ]] && mv "$d" "$OUT_DIR" && break
    done
    [[ ! -d "$OUT_DIR" ]] && mkdir -p "$OUT_DIR" && unzip -q -o "$ZIP_FILE" -d "$OUT_DIR"
    rm -f "$ZIP_FILE"
    echo "已解压到: $OUT_DIR"
  else
    echo "下载失败或返回非 zip（可能是认证失败），请检查用户名和 App Password"
    rm -f "$ZIP_FILE"
    exit 1
  fi
else
  echo "下载请求失败，请检查网络和凭证"
  exit 1
fi
