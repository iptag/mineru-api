/**
 * 文档转换 API 路由
 * 处理文件上传和转换为 Markdown 的请求
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

// 导入中间件和工具
const { upload, handleUploadError, cleanupTempFile } = require('../middleware/upload');
const logger = require('../utils/logger');
const { fixChineseFilename, detectEncodingIssue } = require('../utils/encoding');

// 导入 MinerU API
const {
    FileTypeDetector,
    FileDownloader,
    MineruFileUploader
} = require('../mineru-api');

const router = express.Router();

/**
 * GET /api/supported-types
 * 获取支持的文件类型信息
 */
router.get('/supported-types', (req, res) => {
    try {
        const supportedTypes = FileTypeDetector.SUPPORTED_TYPES;
        const extensions = FileTypeDetector.getSupportedExtensions();
        const description = FileTypeDetector.getSupportedTypesDescription();

        res.json({
            success: true,
            message: '支持的文件类型信息',
            data: {
                types: supportedTypes,
                extensions: extensions,
                description: description,
                maxFileSizes: {
                    PDF: '100MB',
                    WORD: '50MB',
                    IMAGE: '20MB'
                }
            }
        });
    } catch (error) {
        logger.error('获取支持的文件类型失败:', error);
        res.status(500).json({
            success: false,
            message: '获取支持的文件类型失败',
            error: 'INTERNAL_ERROR'
        });
    }
});

/**
 * POST /api/convert
 * 主要的文档转换接口
 */
router.post('/convert', upload, handleUploadError, async (req, res) => {
    let tempFilePath = null;
    
    try {
        // 检查是否有上传的文件
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请上传一个文件',
                error: 'NO_FILE_UPLOADED'
            });
        }

        tempFilePath = req.file.path;
        let originalName = req.file.originalname;
        const fileSize = req.file.size;
        const mimeType = req.file.mimetype;

        // 处理中文文件名编码问题
        if (originalName) {
            const issue = detectEncodingIssue(originalName);
            if (issue.hasIssue) {
                logger.info(`检测到文件名编码问题: ${issue.description} - "${originalName}"`);
                const fixedName = fixChineseFilename(originalName);
                if (fixedName !== originalName) {
                    originalName = fixedName;
                    logger.info(`修复文件名编码: "${req.file.originalname}" -> "${originalName}"`);
                }
            }
        }

        logger.info(`收到文件转换请求: ${originalName}`, {
            size: fileSize,
            mimetype: mimeType,
            tempPath: tempFilePath
        });

        // 解析转换选项
        let options = {};
        if (req.body.options) {
            try {
                options = JSON.parse(req.body.options);
            } catch (error) {
                logger.warn('解析转换选项失败，使用默认选项:', error.message);
            }
        }

        // 创建文件对象
        const fileObject = {
            name: originalName,
            path: tempFilePath,
            size: fileSize,
            type: mimeType
        };

        // 验证文件类型
        const validation = FileTypeDetector.validateFile(fileObject);
        if (!validation.valid) {
            await cleanupTempFile(tempFilePath);
            return res.status(400).json({
                success: false,
                message: validation.error,
                error: 'INVALID_FILE'
            });
        }

        logger.info(`文件验证通过: ${validation.fileType.description}`);

        // 创建 MinerU 上传器
        const uploader = new MineruFileUploader({
            baseURL: process.env.MINERU_BASE_URL || 'https://mineru.org.cn/api/v4',
            timeout: parseInt(process.env.MINERU_TIMEOUT) || 60000,
            maxConcurrency: parseInt(process.env.MINERU_CONCURRENCY) || 6,
            allowedFileTypes: ['PDF', 'WORD', 'IMAGE'],
            enableFileValidation: true
        });

        // 设置转换参数
        const convertParams = {
            is_ocr: options.is_ocr !== undefined ? options.is_ocr : false,
            enable_formula: options.enable_formula !== undefined ? options.enable_formula : true,
            enable_table: options.enable_table !== undefined ? options.enable_table : true,
            model_version: options.model_version || "v2",
            language: options.language || null,
            is_chem: options.is_chem !== undefined ? options.is_chem : false
        };

        logger.info('开始文档转换流程', { params: convertParams });

        // 执行转换
        const result = await uploader.uploadAndExtract([fileObject], {
            params: convertParams,
            pollInterval: 8000,  // 8秒轮询一次
            maxWaitTime: 1800000, // 30分钟超时
            onProgress: (progress) => {
                logger.info(`转换进度: 任务${progress.taskId} - ${progress.state} - ${progress.progress}%`);
            }
        });

        // 清理临时文件
        await cleanupTempFile(tempFilePath);
        tempFilePath = null;

        // 处理结果
        if (result.success && result.results.length > 0) {
            const taskResult = result.results[0];
            
            if (taskResult.state === 'done') {
                // 转换成功
                const responseData = {
                    filename: taskResult.file_name,
                    fileType: validation.fileType.type,
                    taskId: taskResult.task_id,
                    markdownUrl: taskResult.full_md_link,
                    layoutUrl: taskResult.layout_url
                };

                // 可选：下载 Markdown 内容
                if (req.query.includeContent === 'true' && taskResult.full_md_link) {
                    try {
                        const response = await require('axios').get(taskResult.full_md_link, {
                            responseType: 'text',
                            timeout: 30000
                        });
                        responseData.markdownContent = response.data;
                    } catch (error) {
                        logger.warn('下载 Markdown 内容失败:', error.message);
                    }
                }

                logger.success(`文档转换成功: ${originalName} -> ${taskResult.full_md_link}`);

                res.json({
                    success: true,
                    message: '文档转换成功',
                    data: responseData
                });
            } else {
                // 转换失败
                logger.error(`文档转换失败: ${originalName}`, {
                    state: taskResult.state,
                    error: taskResult.err_msg
                });

                res.status(422).json({
                    success: false,
                    message: `文档转换失败: ${taskResult.err_msg || '未知错误'}`,
                    error: 'CONVERSION_FAILED',
                    data: {
                        filename: taskResult.file_name,
                        taskId: taskResult.task_id,
                        state: taskResult.state
                    }
                });
            }
        } else {
            // 没有结果
            logger.error(`文档转换无结果: ${originalName}`);
            
            res.status(500).json({
                success: false,
                message: '文档转换失败，未获取到结果',
                error: 'NO_RESULT'
            });
        }

    } catch (error) {
        logger.error('文档转换过程中发生错误:', error);

        // 清理临时文件
        if (tempFilePath) {
            await cleanupTempFile(tempFilePath);
        }

        // 根据错误类型返回不同的状态码
        let statusCode = 500;
        let errorCode = 'INTERNAL_ERROR';
        let message = '文档转换失败';

        if (error.message.includes('文件') && error.message.includes('验证失败')) {
            statusCode = 400;
            errorCode = 'VALIDATION_ERROR';
            message = error.message;
        } else if (error.message.includes('超时') || error.message.includes('timeout')) {
            statusCode = 408;
            errorCode = 'TIMEOUT_ERROR';
            message = '转换超时，请稍后重试';
        } else if (error.message.includes('网络') || error.message.includes('连接')) {
            statusCode = 503;
            errorCode = 'NETWORK_ERROR';
            message = '网络连接失败，请稍后重试';
        }

        res.status(statusCode).json({
            success: false,
            message: message,
            error: errorCode,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
