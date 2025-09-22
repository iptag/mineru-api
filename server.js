/**
 * MinerU API Server
 * 
 * 基于 mineru-api.js 的在线文档转换服务
 * 支持 PDF、Word 文档、图片转换为 Markdown 格式
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

// 导入路由
const convertRouter = require('./routes/convert');

// 导入工具
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 8000;

// 创建必要的目录
const TEMP_DIR = path.join(__dirname, 'temp');
const LOGS_DIR = path.join(__dirname, 'logs');

async function ensureDirectories() {
    try {
        if (!fs.existsSync(TEMP_DIR)) {
            fs.mkdirSync(TEMP_DIR, { recursive: true });
        }
        if (!fs.existsSync(LOGS_DIR)) {
            fs.mkdirSync(LOGS_DIR, { recursive: true });
        }
        logger.info('目录创建完成');
    } catch (error) {
        logger.error('创建目录失败:', error);
        process.exit(1);
    }
}

// 基础 CORS 支持
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// 简单的请求日志
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// JSON 解析中间件，支持UTF-8编码
app.use(express.json({
    limit: '1mb',
    type: 'application/json',
    verify: (req, res, buf, encoding) => {
        // 确保使用UTF-8编码
        if (encoding !== 'utf8') {
            req.rawBody = buf.toString('utf8');
        }
    }
}));
app.use(express.urlencoded({
    extended: true,
    limit: '1mb',
    type: 'application/x-www-form-urlencoded',
    verify: (req, res, buf, encoding) => {
        // 确保使用UTF-8编码
        if (encoding !== 'utf8') {
            req.rawBody = buf.toString('utf8');
        }
    }
}));

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'MinerU API Server is running',
        timestamp: new Date().toISOString(),
        version: require('./package.json').version,
        uptime: process.uptime()
    });
});

// API 路由
app.use('/api', convertRouter);

// 根路径
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to MinerU API Server',
        version: require('./package.json').version,
        endpoints: {
            health: '/health',
            convert: '/api/convert',
            supportedTypes: '/api/supported-types'
        },
        documentation: 'https://github.com/your-username/mineru-api-server'
    });
});

// 404 处理
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        error: 'NOT_FOUND'
    });
});

// 全局错误处理
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    
    // 清理可能的临时文件
    if (req.file && req.file.path) {
        try {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
        } catch (err) {
            logger.error('Failed to cleanup temp file:', err);
        }
    }
    
    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal server error',
        error: error.code || 'INTERNAL_ERROR'
    });
});

// 优雅关闭
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// 启动服务器
async function startServer() {
    try {
        await ensureDirectories();
        
        app.listen(PORT, '0.0.0.0', () => {
            logger.info(`🚀 MinerU API Server started on port ${PORT}`);
            logger.info(`📖 Health check: http://localhost:${PORT}/health`);
            logger.info(`🔄 Convert API: http://localhost:${PORT}/api/convert`);
            logger.info(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
