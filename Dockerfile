# MinerU API Server - 极简版 Dockerfile
FROM node:18-alpine

WORKDIR /app

# 只安装 curl（用于健康检查）
RUN apk add --no-cache curl && rm -rf /var/cache/apk/*

# 复制并安装依赖
COPY package.json ./
RUN npm install --only=production && npm cache clean --force

# 只复制必要的应用文件
COPY server.js mineru-api.js ./
COPY routes/ ./routes/
COPY middleware/ ./middleware/
COPY utils/ ./utils/
COPY config.json ./

# 创建目录并设置权限
RUN mkdir -p temp && adduser -D -s /bin/sh appuser && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# 简化的健康检查
HEALTHCHECK --interval=60s --timeout=5s --retries=2 \
    CMD curl -f http://localhost:8000/health || exit 1

# 直接启动，不使用 npm
CMD ["node", "server.js"]
