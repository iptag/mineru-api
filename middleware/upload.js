/**
 * 文件上传中间件
 * 配置 multer 用于处理文件上传
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { fixChineseFilename, detectEncodingIssue } = require('../utils/encoding');

// 临时文件存储目录
const TEMP_DIR = path.join(__dirname, '..', 'temp');

// 确保临时目录存在
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// 存储配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        // 生成唯一文件名：时间戳 + 随机数 + 原扩展名
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const ext = path.extname(file.originalname);
        const filename = `${timestamp}_${random}${ext}`;
        cb(null, filename);
    }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
    // 支持的文件类型
    const allowedTypes = {
        // PDF
        'application/pdf': ['.pdf'],
        // Word 文档
        'application/msword': ['.doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        // 图片
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/gif': ['.gif'],
        'image/bmp': ['.bmp'],
        'image/tiff': ['.tiff', '.tif'],
        'image/webp': ['.webp']
    };

    const fileExt = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;

    // 检查 MIME 类型
    if (!allowedTypes[mimeType]) {
        logger.warn(`Rejected file: unsupported MIME type ${mimeType}`, {
            filename: file.originalname,
            mimetype: mimeType
        });
        return cb(new Error(`不支持的文件类型: ${mimeType}`), false);
    }

    // 检查文件扩展名
    if (!allowedTypes[mimeType].includes(fileExt)) {
        logger.warn(`Rejected file: extension mismatch`, {
            filename: file.originalname,
            mimetype: mimeType,
            extension: fileExt
        });
        return cb(new Error(`文件扩展名与类型不匹配: ${fileExt}`), false);
    }

    logger.info(`Accepted file: ${file.originalname}`, {
        mimetype: mimeType,
        extension: fileExt
    });

    cb(null, true);
};

// Multer 配置
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
        files: 1 // 一次只能上传一个文件
    },
    // 处理中文文件名编码问题
    preservePath: false,
    // 自定义文件名处理
    onFileUploadStart: function (file) {
        // 使用专用的编码修复工具
        if (file.originalname) {
            const issue = detectEncodingIssue(file.originalname);
            if (issue.hasIssue) {
                logger.info(`检测到文件名编码问题: ${issue.description}`);
                const fixedName = fixChineseFilename(file.originalname);
                if (fixedName !== file.originalname) {
                    file.originalname = fixedName;
                    logger.info(`修复文件名编码: "${file.originalname}" -> "${fixedName}"`);
                }
            }
        }
    }
});

// 错误处理中间件
const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        let message = '文件上传失败';
        let code = 'UPLOAD_ERROR';

        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                message = '文件大小超过限制 (100MB)';
                code = 'FILE_TOO_LARGE';
                break;
            case 'LIMIT_FILE_COUNT':
                message = '一次只能上传一个文件';
                code = 'TOO_MANY_FILES';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = '意外的文件字段';
                code = 'UNEXPECTED_FIELD';
                break;
        }

        logger.error(`Upload error: ${message}`, {
            code: error.code,
            field: error.field
        });

        return res.status(400).json({
            success: false,
            message: message,
            error: code
        });
    }

    if (error.message.includes('不支持的文件类型') ||
        error.message.includes('文件扩展名与类型不匹配')) {
        return res.status(400).json({
            success: false,
            message: error.message,
            error: 'INVALID_FILE_TYPE'
        });
    }

    next(error);
};

// 清理临时文件的工具函数
const cleanupTempFile = async (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info(`Cleaned up temp file: ${filePath}`);
        }
    } catch (error) {
        logger.error(`Failed to cleanup temp file: ${filePath}`, error);
    }
};

module.exports = {
    upload: upload.single('file'),
    handleUploadError,
    cleanupTempFile,
    TEMP_DIR
};
