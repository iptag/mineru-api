/**
 * 文件名编码处理工具
 * 解决中文文件名在HTTP传输过程中的编码问题
 */

const logger = require('./logger');

/**
 * 修复中文文件名编码问题
 * @param {string} filename - 原始文件名
 * @returns {string} - 修复后的文件名
 */
function fixChineseFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        return filename;
    }

    try {
        // 方法1: 检查是否包含典型的UTF-8乱码字符
        const corruptedChars = /[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/;
        if (corruptedChars.test(filename)) {
            // 尝试从latin1重新编码为utf8
            const buffer = Buffer.from(filename, 'latin1');
            const utf8Name = buffer.toString('utf8');
            
            // 验证是否包含中文字符
            if (/[\u4e00-\u9fa5]/.test(utf8Name)) {
                logger.info(`修复中文文件名编码: "${filename}" -> "${utf8Name}"`);
                return utf8Name;
            }
        }

        // 方法2: 检查是否包含问号（可能是编码失败的占位符）
        if (filename.includes('?') && filename.length > 10) {
            logger.warn(`检测到可能的文件名编码问题: ${filename}`);
            
            // 尝试不同的编码方式
            const encodings = ['utf8', 'gbk', 'gb2312'];
            for (const encoding of encodings) {
                try {
                    const buffer = Buffer.from(filename, 'latin1');
                    const decoded = buffer.toString(encoding);
                    if (/[\u4e00-\u9fa5]/.test(decoded) && !decoded.includes('?')) {
                        logger.info(`使用${encoding}编码修复文件名: "${filename}" -> "${decoded}"`);
                        return decoded;
                    }
                } catch (err) {
                    // 忽略编码错误，继续尝试下一种
                }
            }
        }

        // 方法3: 检查是否是URL编码
        if (filename.includes('%')) {
            try {
                const decoded = decodeURIComponent(filename);
                if (decoded !== filename && /[\u4e00-\u9fa5]/.test(decoded)) {
                    logger.info(`URL解码修复文件名: "${filename}" -> "${decoded}"`);
                    return decoded;
                }
            } catch (err) {
                logger.warn('URL解码失败:', err.message);
            }
        }

        // 如果没有检测到问题，返回原文件名
        return filename;

    } catch (error) {
        logger.error('文件名编码修复失败:', error);
        return filename;
    }
}

/**
 * 验证文件名是否包含中文字符
 * @param {string} filename - 文件名
 * @returns {boolean} - 是否包含中文
 */
function containsChinese(filename) {
    if (!filename || typeof filename !== 'string') {
        return false;
    }
    return /[\u4e00-\u9fa5]/.test(filename);
}

/**
 * 检测文件名编码问题
 * @param {string} filename - 文件名
 * @returns {object} - 检测结果 {hasIssue: boolean, type: string, description: string}
 */
function detectEncodingIssue(filename) {
    if (!filename || typeof filename !== 'string') {
        return { hasIssue: false, type: 'none', description: '文件名为空或无效' };
    }

    // 检查UTF-8乱码字符
    if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(filename)) {
        return { 
            hasIssue: true, 
            type: 'utf8_corruption', 
            description: '检测到UTF-8编码乱码字符' 
        };
    }

    // 检查问号占位符
    if (filename.includes('?') && filename.length > 5) {
        return { 
            hasIssue: true, 
            type: 'placeholder', 
            description: '检测到编码失败占位符' 
        };
    }

    // 检查URL编码
    if (filename.includes('%') && /%[0-9A-Fa-f]{2}/.test(filename)) {
        return { 
            hasIssue: true, 
            type: 'url_encoded', 
            description: '检测到URL编码' 
        };
    }

    return { hasIssue: false, type: 'none', description: '未检测到编码问题' };
}

/**
 * 安全的文件名处理（移除或替换不安全字符）
 * @param {string} filename - 原始文件名
 * @returns {string} - 安全的文件名
 */
function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        return 'unnamed_file';
    }

    // 先修复编码问题
    let safeName = fixChineseFilename(filename);

    // 移除或替换不安全的字符
    safeName = safeName
        .replace(/[<>:"/\\|?*]/g, '_')  // 替换Windows不允许的字符
        .replace(/\s+/g, '_')          // 替换空格
        .replace(/_{2,}/g, '_')        // 合并多个下划线
        .replace(/^_+|_+$/g, '');      // 移除开头和结尾的下划线

    // 确保文件名不为空
    if (!safeName) {
        safeName = 'unnamed_file';
    }

    // 限制文件名长度（保留扩展名）
    const maxLength = 200;
    if (safeName.length > maxLength) {
        const ext = safeName.substring(safeName.lastIndexOf('.'));
        const nameWithoutExt = safeName.substring(0, safeName.lastIndexOf('.'));
        safeName = nameWithoutExt.substring(0, maxLength - ext.length) + ext;
    }

    return safeName;
}

module.exports = {
    fixChineseFilename,
    containsChinese,
    detectEncodingIssue,
    sanitizeFilename
};
