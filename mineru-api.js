/**
 * MinerU文件上传核心库
 *
 * 提供完整的文件上传到CDN、转换为Markdown并下载的功能
 * 支持PDF、Word文档、图片等多种文件类型
 * 基于MinerU官方网页端服务实现
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * 文件类型检测器
 * 支持PDF、Word文档、图片等多种文件类型的检测和验证
 */
class FileTypeDetector {
    // 支持的文件类型定义
    static SUPPORTED_TYPES = {
        PDF: {
            extensions: ['.pdf'],
            mimeTypes: ['application/pdf'],
            category: 'document',
            maxSize: 100 * 1024 * 1024, // 100MB
            description: 'PDF文档'
        },
        WORD: {
            extensions: ['.doc', '.docx'],
            mimeTypes: [
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ],
            category: 'document',
            maxSize: 50 * 1024 * 1024, // 50MB
            description: 'Word文档'
        },
        IMAGE: {
            extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'],
            mimeTypes: [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/bmp',
                'image/tiff',
                'image/webp'
            ],
            category: 'image',
            maxSize: 20 * 1024 * 1024, // 20MB
            description: '图片文件'
        }
    };

    /**
     * 检测文件类型
     * @param {String} fileName - 文件名
     * @param {String} mimeType - MIME类型（可选）
     * @returns {Object|null} - 文件类型信息或null
     */
    static detectFileType(fileName, mimeType = null) {
        if (!fileName) return null;
        const fileExt = path.extname(fileName).toLowerCase();
        // 遍历支持的文件类型
        for (const [typeName, typeInfo] of Object.entries(this.SUPPORTED_TYPES)) {
            // 检查文件扩展名
            if (typeInfo.extensions.includes(fileExt)) {
                // 如果提供了MIME类型，也要验证
                if (mimeType && !typeInfo.mimeTypes.includes(mimeType)) {
                    console.warn(`文件 ${fileName} 的MIME类型 ${mimeType} 与扩展名 ${fileExt} 不匹配`);
                }
                return {
                    type: typeName,
                    ...typeInfo,
                    detectedBy: mimeType ? 'extension+mime' : 'extension'
                };
            }
        }
        return null;
    }

    /**
     * 根据文件类型获取Content-Type
     * @param {String} fileType - 文件类型（PDF/WORD/IMAGE）
     * @param {String} fileName - 文件名
     * @returns {String} - Content-Type字符串
     */
    static getContentType(fileType, fileName) {
        const typeInfo = this.SUPPORTED_TYPES[fileType];
        if (!typeInfo) {
            throw new Error(`不支持的文件类型: ${fileType}`);
        }
        const fileExt = path.extname(fileName).toLowerCase();
        // 根据文件扩展名返回具体的MIME类型
        switch (fileType) {
            case 'PDF':
                return 'application/pdf';
            case 'WORD':
                return fileExt === '.docx'
                    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    : 'application/msword';
            case 'IMAGE':
                switch (fileExt) {
                    case '.jpg':
                    case '.jpeg':
                        return 'image/jpeg';
                    case '.png':
                        return 'image/png';
                    case '.gif':
                        return 'image/gif';
                    case '.bmp':
                        return 'image/bmp';
                    case '.tiff':
                        return 'image/tiff';
                    case '.webp':
                        return 'image/webp';
                    default:
                        return 'image/jpeg'; // 默认
                }
            default:
                return 'application/octet-stream';
        }
    }

    /**
     * 验证文件
     * @param {Object} file - 文件对象 {name, size, type, path}
     * @param {Array} allowedTypes - 允许的文件类型数组，如 ['PDF', 'WORD']
     * @returns {Object} - 验证结果 {valid, fileType, error}
     */
    static validateFile(file, allowedTypes = null) {
        if (!file || !file.name) {
            return {
                valid: false,
                error: '文件信息不完整'
            };
        }
        // 检测文件类型
        const fileTypeInfo = this.detectFileType(file.name, file.type);
        if (!fileTypeInfo) {
            return {
                valid: false,
                error: `不支持的文件类型: ${path.extname(file.name)}`
            };
        }
        // 检查是否在允许的类型列表中
        if (allowedTypes && !allowedTypes.includes(fileTypeInfo.type)) {
            return {
                valid: false,
                error: `文件类型 ${fileTypeInfo.description} 不在允许的类型列表中`
            };
        }
        // 检查文件大小
        if (file.size && file.size > fileTypeInfo.maxSize) {
            const maxSizeMB = Math.round(fileTypeInfo.maxSize / (1024 * 1024));
            const fileSizeMB = Math.round(file.size / (1024 * 1024));
            return {
                valid: false,
                error: `文件大小 ${fileSizeMB}MB 超过限制 ${maxSizeMB}MB`
            };
        }
        return {
            valid: true,
            fileType: fileTypeInfo,
            contentType: this.getContentType(fileTypeInfo.type, file.name)
        };
    }

    /**
     * 获取支持的文件扩展名列表
     * @returns {Array} - 扩展名数组
     */
    static getSupportedExtensions() {
        const extensions = [];
        for (const typeInfo of Object.values(this.SUPPORTED_TYPES)) {
            extensions.push(...typeInfo.extensions);
        }
        return extensions;
    }
    /**
     * 获取支持的文件类型描述
     * @returns {String} - 描述字符串
     */
    static getSupportedTypesDescription() {
        const descriptions = [];
        for (const [typeName, typeInfo] of Object.entries(this.SUPPORTED_TYPES)) {
            descriptions.push(`${typeInfo.description}(${typeInfo.extensions.join(', ')})`);
        }
        return descriptions.join('、');
    }
    /**
     * 创建标准文件对象
     * 根据文件路径创建包含name、path、type的标准文件对象
     * @param {String|Array} pathOrPaths - 单个文件路径或文件路径数组
     * @param {Object} options - 可选配置 {autoDetectSize: boolean}
     * @returns {Object|Array} - 标准文件对象
     */
    static createFileObject(pathOrPaths, options = {}) {
        const { autoDetectSize = false } = options;
        const processPath = (filePath) => {
            const fileName = path.basename(filePath);
            const detected = this.detectFileType(fileName);
            let fileObj = {
                name: fileName,
                path: filePath,
                type: detected ? this.getContentType(detected.type, fileName) : 'application/octet-stream'
            };
            // 可选：自动检测文件大小
            if (autoDetectSize) {
                try {

                    if (fs.existsSync(filePath)) {
                        const stats = fs.statSync(filePath);
                        fileObj.size = stats.size;
                    }
                } catch (error) {
                    console.warn(`无法获取文件大小: ${filePath}`, error.message);
                }
            }
            return fileObj;
        };
        // 处理数组或单个路径
        if (Array.isArray(pathOrPaths)) {
            return pathOrPaths.map(processPath);
        } else {
            return processPath(pathOrPaths);
        }
    }
}

/**
 * 并发控制器 - 模拟sxe(6)函数
 * 限制同时进行的上传数量
 */
class ConcurrencyController {
    constructor(maxConcurrency = 6) {
        this.maxConcurrency = maxConcurrency;
        this.running = 0;
        this.queue = [];
    }
    async execute(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.process();
        });
    }
    async process() {
        if (this.running >= this.maxConcurrency || this.queue.length === 0) {
            return;
        }
        this.running++;
        const { task, resolve, reject } = this.queue.shift();
        try {
            const result = await task();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.running--;
            this.process();
        }
    }
}

/**
 * 文件下载器 - 下载转换结果
 */
class FileDownloader {
    /**
     * 下载Markdown文件到本地
     * @param {String} markdownUrl - Markdown文件URL
     * @param {String} fileName - 保存的文件名（不含扩展名）
     * @param {String} outputDir - 输出目录，默认为当前目录
     * @returns {Promise<String>} - 保存的文件路径
     */
    static async downloadMarkdown(markdownUrl, fileName, outputDir = '.') {
        try {
            console.log(`📥 开始下载Markdown文件: ${markdownUrl}`);
            const response = await axios.get(markdownUrl, {
                responseType: 'text',
                timeout: 60000
            });
            if (response.status !== 200) {
                throw new Error(`下载失败: HTTP ${response.status}`);
            }
            // 确保输出目录存在
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            // 构建文件路径
            const filePath = path.join(outputDir, `${fileName}.md`);
            // 写入文件
            fs.writeFileSync(filePath, response.data, 'utf8');
            console.log(`✅ Markdown文件已保存: ${filePath}`);
            return filePath;

        } catch (error) {
            console.error('❌ 下载Markdown文件失败:', error.message);
            throw error;
        }
    }

    /**
     * 批量下载多个文件的Markdown结果
     * @param {Array} results - 转换结果数组
     * @param {String} outputDir - 输出目录
     * @returns {Promise<Array>} - 下载的文件路径数组
     */
    static async downloadBatchMarkdown(results, outputDir = './output') {
        const downloadPromises = results.map(async (result, index) => {
            if (result.success && result.full_md_link) {
                const fileName = result.file_name.replace(/\.[^/.]+$/, '') || `document_${index + 1}`;
                return await this.downloadMarkdown(result.full_md_link, fileName, outputDir);
            }
            return null;
        });
        const downloadedFiles = await Promise.all(downloadPromises);
        return downloadedFiles.filter(file => file !== null);
    }
}

/**
 * 文件预处理器
 * 处理页面范围、文件信息等预处理逻辑
 */
class FilePreprocessor {
    /**
     * 生成唯一ID - 模拟Sr()函数
     */
    static generateUniqueId() {
        return Math.random().toString(36).substring(2, 15) +
               Math.random().toString(36).substring(2, 15);
    }
    /**
     * 处理页面范围
     * @param {Array} pageRanges - 页面范围数组，如 [1, 2, 3, 5, 6, 7]
     * @returns {String} - 格式化的页面范围字符串，如 "1-3,5-7"
     */
    static formatPageRanges(pageRanges) {
        if (!pageRanges || pageRanges.length === 0) {
            return "";
        }
        // 排序并去重
        const sortedPages = [...new Set(pageRanges)].sort((a, b) => a - b);
        const ranges = [];
        let start = sortedPages[0];
        let end = start;
        for (let i = 1; i <= sortedPages.length; i++) {
            if (i < sortedPages.length && sortedPages[i] === end + 1) {
                end = sortedPages[i];
            } else {
                if (start === end) {
                    ranges.push(start.toString());
                } else {
                    ranges.push(`${start}-${end}`);
                }
                if (i < sortedPages.length) {
                    start = sortedPages[i];
                    end = start;
                }
            }
        }
        return ranges.join(',');
    }
    /**
     * 创建任务元数据
     * @param {Array} files - 文件数组
     * @param {Object} params - 参数对象
     * @returns {Array} - 任务元数据数组
     */
    static createTaskMetadata(files, params = {}) {
        return files.map((file) => {
            const dataId = this.generateUniqueId();
            return {
                file_name: file.name,
                state: 'WAITING_FILE', // Le.WAITING_FILE
                createdAt: Date.now(),
                full_md_link: "",
                url: "",
                data_id: dataId,
                tmp_id: dataId,
                model_version: params.model_version || "v2"
            };
        });
    }
}

const chokidar = require('chokidar');

/**
 * Batch API客户端
 * 用于获取CDN上传URL
 */
class BatchAPIClient {
    constructor(config = {}) {
        this.configPath = path.join(__dirname, 'config.json');
        this.passedInConfig = config;
        this.loadConfig();

        // 初始化并监视配置文件变化
        this.initializeWatcher();
    }

    loadConfig() {
        let fileConfig = {};
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                const parsedConfig = JSON.parse(configData);
                fileConfig = parsedConfig.mineru || {};
                console.log('✅ 成功加载配置文件');
            } else {
                console.warn('⚠️ 配置文件 config.json 不存在，使用默认配置');
            }
        } catch (error) {
            console.error('❌ 读取或解析配置文件失败:', error.message);
            console.warn('⚠️ 将使用默认配置或传入的配置参数');
        }

        // 配置优先级：传入参数 > 配置文件 > 默认值
        this.baseURL = this.passedInConfig.baseURL || fileConfig.baseURL || 'https://mineru.org.cn/api/v4';
        this.timeout = this.passedInConfig.timeout || fileConfig.timeout || 30000;
        this.authToken = this.passedInConfig.authToken || fileConfig.authToken;

        // 验证必要的配置
        if (!this.authToken) {
            // 仅在启动时抛出错误，重载失败时只打印警告
            if (!this.isReloading) {
                throw new Error('❌ 缺少认证token！请在config.json中配置authToken或通过构造函数参数传入');
            } else {
                console.error('❌ 热重载失败：配置文件中缺少authToken');
            }
        }

        if (!this.isReloading) {
            console.log('🔧 BatchAPIClient配置完成');
            console.log(`📍 Base URL: ${this.baseURL}`);
            console.log(`⏱️ Timeout: ${this.timeout}ms`);
            console.log(`🔑 Auth Token: ${this.authToken ? this.authToken.substring(0, 20) + '...' : '未设置'}`);
        }
    }

    initializeWatcher() {
        const watcher = chokidar.watch(this.configPath, {
            persistent: true,
            ignoreInitial: true
        });

        watcher.on('change', (path) => {
            console.log(`🔄 检测到配置文件 ${path} 发生变化，正在热重载...`);
            this.isReloading = true;
            try {
                this.loadConfig();
                console.log('✅ 配置文件热重载成功！');
                console.log(`   - Base URL: ${this.baseURL}`);
                console.log(`   - Timeout: ${this.timeout}ms`);
                console.log(`   - Auth Token: ${this.authToken ? this.authToken.substring(0, 20) + '...' : '未设置'}`);
            } catch (error) {
                console.error('❌ 配置文件热重载失败:', error.message);
            } finally {
                this.isReloading = false;
            }
        });

        watcher.on('error', (error) => {
            console.error('❌ 文件监视器发生错误:', error);
        });
    }

    /**
     * 获取文件上传URL
     * @param {Object} payload - 请求载荷
     * @returns {Promise} - 包含上传URL和任务ID的响应
     */
    async getFileUrls(payload) {
        try {
            console.log('📤 调用Batch API获取上传URL...');
            const response = await axios.post(`${this.baseURL}/file-urls/batch`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': this.authToken
                },
                timeout: this.timeout
            });
            if (response.data && response.data.code === 0) {
                console.log('✅ 成功获取上传URL');
                return response.data.data;
            } else {
                throw new Error(`API返回错误: ${response.data?.msg || '未知错误'}`);
            }
        } catch (error) {
            console.error('❌ 获取上传URL失败:', error.message);
            if (error.response) {
                console.error('响应状态:', error.response.status);
                console.error('响应数据:', error.response.data);
            }
            throw error;
        }
    }
    /**
     * 查询任务进度
     * @param {String} taskId - 任务ID
     * @returns {Promise} - 任务状态信息
     */
    async getTaskProgress(taskId) {
        try {
            // 注意：进度查询使用的是mineru.net域名
            const progressURL = `https://mineru.net/api/v4/extract/task/${taskId}`;
            const response = await axios.get(progressURL, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': this.authToken
                },
                timeout: this.timeout
            });
            if (response.data && response.data.code === 0) {
                return response.data.data;
            } else {
                throw new Error(`查询进度失败: ${response.data?.msg || '未知错误'}`);
            }
        } catch (error) {
            console.error(`❌ 查询任务 ${taskId} 进度失败:`, error.message);
            throw error;
        }
    }
}
/**
 * CDN文件上传器
 * 直接上传文件到CDN，支持多种文件类型的自动Content-Type检测
 * 使用原生https模块避免axios的自动Content-Type设置问题
 */
class CDNFileUploader {
    /**
     * 上传单个文件到CDN - 模拟Tue函数，增强版支持自动Content-Type检测
     * @param {File|Buffer|Stream|String} file - 文件对象或文件路径
     * @param {String} uploadUrl - CDN上传URL
     * @param {String|Object} contentTypeOrFileInfo - Content-Type字符串或文件信息对象 {name, type}
     * @param {Object} callbacks - 回调函数 {onSuccess, onError, onProgress}
     * @returns {Promise<Boolean>} - 上传成功返回true
     */
    static async uploadFile(file, uploadUrl, contentTypeOrFileInfo, callbacks = {}) {
        const { onSuccess, onError, onProgress } = callbacks;
        try {
            // 自动检测Content-Type
            let contentType;
            let fileName = '';
            if (typeof contentTypeOrFileInfo === 'string') {
                // 兼容旧版本：直接传入Content-Type字符串（优先使用，避免签名问题）
                contentType = contentTypeOrFileInfo;
                console.log('🔒 使用指定的Content-Type（避免签名不匹配）');
            } else if (contentTypeOrFileInfo && typeof contentTypeOrFileInfo === 'object') {
                // 新版本：传入文件信息对象
                fileName = contentTypeOrFileInfo.name || '';
                const fileType = contentTypeOrFileInfo.type;
                // 优先使用传入的type字段（通常来自服务器响应，避免签名问题）
                if (fileType) {
                    contentType = fileType;
                    console.log('🔒 使用服务器指定的Content-Type（避免签名不匹配）');
                } else if (fileName) {
                    // 只有在没有指定type时才进行自动检测
                    const detectedType = FileTypeDetector.detectFileType(fileName);
                    if (detectedType) {
                        contentType = FileTypeDetector.getContentType(detectedType.type, fileName);
                        console.log(`🔍 自动检测文件类型: ${detectedType.type} (${detectedType.description})`);
                    } else {
                        contentType = 'application/octet-stream';
                        console.warn(`⚠️ 无法检测文件类型，使用默认: ${contentType}`);
                    }
                } else {
                    contentType = 'application/octet-stream';
                }
            } else {
                // 默认Content-Type
                contentType = 'application/octet-stream';
                console.warn('⚠️ 未提供Content-Type信息，使用默认值');
            }
            console.log(`📤 开始上传文件到CDN: ${uploadUrl}`);
            console.log(`📋 使用Content-Type: ${contentType}`);
            console.log(`📄 文件名: ${fileName || '未知'}`);
            // 如果是文件路径，读取文件内容
            let fileData = file;
            if (typeof file === 'string') {
                // 检查文件是否存在
                if (!fs.existsSync(file)) {
                    throw new Error(`文件不存在: ${file}`);
                }
                // 检查文件大小，避免读取过大的文件到内存
                const stats = fs.statSync(file);
                if (stats.size > 100 * 1024 * 1024) { // 100MB限制
                    throw new Error(`文件过大: ${Math.round(stats.size / (1024 * 1024))}MB，超过100MB限制`);
                }
                fileData = fs.readFileSync(file);
                // 如果没有提供文件名，从路径中提取
                if (!fileName) {
                    fileName = path.basename(file);
                    console.log(`📄 从路径提取文件名: ${fileName}`);
                }
            }
            const response = await axios.put(uploadUrl, fileData, {
                headers: {
                    'Content-Type': contentType
                },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total && onProgress) {
                        const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                        onProgress(progress);
                    }
                },
                // 重要：禁用axios的自动数据转换，直接发送原始数据
                transformRequest: [(data) => data],
                // 设置响应类型为text，避免axios尝试解析响应
                responseType: 'text',
                // 增加超时时间
                timeout: 300000 // 5分钟
            });
            if (response.status !== 200) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            console.log('✅ 文件上传到CDN成功');
            onSuccess?.();
            return true;
        } catch (error) {
            console.error('❌ 文件上传到CDN失败:', error.message);
            if (error.response) {
                console.error('响应状态:', error.response.status);
                console.error('响应数据:', error.response.data);
            }
            onError?.();
            throw error;
        }
    }
}

/**
 * 任务进度监控器
 * 用于轮询查询任务进度直到完成
 */
class TaskProgressMonitor {
    constructor(batchClient) {
        this.batchClient = batchClient;
    }
    /**
     * 轮询查询任务进度直到完成
     * @param {Array} taskIds - 任务ID数组
     * @param {Object} options - 配置选项 {pollInterval, maxWaitTime, onProgress}
     * @returns {Promise<Array>} - 完成的任务结果数组
     */
    async waitForCompletion(taskIds, options = {}) {
        const {
            pollInterval = 5000,  // 5秒轮询一次
            maxWaitTime = 1800000, // 30分钟超时
            onProgress
        } = options;
        console.log(`🔄 开始监控 ${taskIds.length} 个任务的进度...`);
        const startTime = Date.now();
        const results = [];
        const pendingTasks = [...taskIds];
        while (pendingTasks.length > 0 && (Date.now() - startTime) < maxWaitTime) {
            const currentResults = await Promise.allSettled(
                pendingTasks.map(taskId => this.batchClient.getTaskProgress(taskId))
            );
            for (let i = pendingTasks.length - 1; i >= 0; i--) {
                const result = currentResults[i];
                const taskId = pendingTasks[i];
                if (result.status === 'fulfilled') {
                    const taskData = result.value;
                    const state = taskData.state;
                    console.log(`📊 任务 ${taskId} 状态: ${state}`);
                    if (state === 'done') {
                        console.log(`✅ 任务 ${taskId} 完成! Markdown链接: ${taskData.full_md_link}`);
                        results.push(taskData);
                        pendingTasks.splice(i, 1);
                    } else if (state === 'failed' || state === 'aborted') {
                        console.log(`❌ 任务 ${taskId} 失败: ${taskData.err_msg || '未知错误'}`);
                        results.push(taskData);
                        pendingTasks.splice(i, 1);
                    } else if (state === 'running') {
                        const progress = taskData.extract_progress;
                        if (progress) {
                            console.log(`🔄 任务 ${taskId} 进度: ${progress.extracted_pages}/${progress.total_pages} 页`);
                        }
                        onProgress?.({
                            taskId,
                            state,
                            progress: progress ? Math.round((progress.extracted_pages / progress.total_pages) * 100) : 0
                        });
                    } else {
                        console.log(`⏳ 任务 ${taskId} 等待中: ${state}`);
                    }
                } else {
                    console.error(`❌ 查询任务 ${taskId} 失败:`, result.reason.message);
                }
            }
            if (pendingTasks.length > 0) {
                console.log(`⏳ 等待 ${pollInterval/1000} 秒后继续查询...`);
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }
        if (pendingTasks.length > 0) {
            console.warn(`⚠️ 超时！仍有 ${pendingTasks.length} 个任务未完成`);
        }
        return results;
    }
}

/**
 * 完整的文件上传器
 * 实现完整的两阶段上传流程：获取上传URL → 上传文件到CDN
 * 支持PDF、Word文档、图片等多种文件类型
 */
class MineruFileUploader {
    constructor(config = {}) {
        this.config = {
            baseURL: config.baseURL || 'https://mineru.org.cn/api/v4',
            timeout: config.timeout || 30000,
            maxConcurrency: config.maxConcurrency || 6,
            // 支持的文件类型，默认支持所有类型
            allowedFileTypes: config.allowedFileTypes || ['PDF', 'WORD', 'IMAGE'],
            // 是否启用文件类型验证
            enableFileValidation: config.enableFileValidation !== false,
            // 默认参数 - 基于真实API调用
            defaultParams: {
                is_ocr: false,
                enable_formula: true,
                enable_table: true,
                model_version: "v2",
                language: null,
                is_chem: false
            },
            ...config
        };
        this.batchClient = new BatchAPIClient({
            baseURL: this.config.baseURL,
            timeout: this.config.timeout,
            authToken: this.config.authToken
        });
        this.progressMonitor = new TaskProgressMonitor(this.batchClient);
        this.concurrencyController = new ConcurrencyController(this.config.maxConcurrency);
    }
    /**
     * 完整的文件上传流程
     * @param {Object} uploadParams - 上传参数 {params, files, onCreateTaskSuccess, onProgress, pageRangeList, onUploadSuccess}
     * @returns {Promise} 上传结果
     */
    async uploadFiles(uploadParams) {
        const {
            params = {},
            files,
            onCreateTaskSuccess,
            onProgress,
            pageRangeList = [],
            onUploadSuccess
        } = uploadParams;
        console.log('🚀 开始执行完整的文件上传流程...');
        // 文件预处理：确保文件对象有完整的type字段
        console.log('🔧 检查文件type字段...');
        const finalFiles = files.map(file => {
            if (!file.type && file.name) {
                const detected = FileTypeDetector.detectFileType(file.name);
                if (detected) {
                    const contentType = FileTypeDetector.getContentType(detected.type, file.name);
                    console.log(`🔍 自动检测: ${file.name} -> ${contentType}`);
                    return { ...file, type: contentType };
                }
            }
            return file;
        });
        // 文件验证阶段
        if (this.config.enableFileValidation) {
            console.log('🔍 开始文件验证...');
            const validationResults = [];
            for (let i = 0; i < finalFiles.length; i++) {
                const file = finalFiles[i];
                const validation = FileTypeDetector.validateFile(file, this.config.allowedFileTypes);
                if (!validation.valid) {
                    throw new Error(`文件 "${file.name}" 验证失败: ${validation.error}`);
                }

                validationResults.push(validation);
                console.log(`✅ 文件 "${file.name}" 验证通过: ${validation.fileType.description}`);
            }
            // 将验证结果存储，供后续使用
            uploadParams._validationResults = validationResults;
        }
        try {
            // 第一步：创建任务元数据
            const taskMetadata = FilePreprocessor.createTaskMetadata(finalFiles, params);
            // 第二步：构建Batch API请求载荷
            // 重要：使用与任务元数据相同的data_id，确保API能正确关联任务
            const batchPayload = {
                ...this.config.defaultParams,
                ...params,
                files: taskMetadata.map((task, index) => ({
                    name: task.file_name,
                    data_id: task.data_id, // 使用相同的data_id
                    page_ranges: pageRangeList[index] ?
                        FilePreprocessor.formatPageRanges(pageRangeList[index]) : ""
                }))
            };
            // 第三步：调用Batch API获取上传URL
            const batchResponse = await this.batchClient.getFileUrls(batchPayload);
            if (!batchResponse) {
                throw new Error('获取上传URL失败');
            }
            // 第四步：合并任务信息和上传URL
            const uploadTasks = taskMetadata.map((task, index) => ({
                ...task,
                upload_url: batchResponse.file_urls?.[index],
                task_id: batchResponse.task_ids?.[index] // API会返回真实的task_ids
            }));
            // 第五步：调用成功回调
            onCreateTaskSuccess?.(uploadTasks, batchResponse.batch_id);
            // 第六步：并发上传文件到CDN
            const uploadPromises = uploadTasks.map((task, index) => {
                const file = finalFiles[index];
                const validationResult = uploadParams._validationResults?.[index];

                // 构建文件信息对象，优先使用服务器返回的Content-Type（重要：避免签名不匹配）
                const fileInfo = {
                    name: file.name,
                    type: batchResponse.headers?.[index]?.["Content-Type"] ||
                          validationResult?.contentType ||
                          "application/octet-stream"
                };
                return this.concurrencyController.execute(() =>
                    CDNFileUploader.uploadFile(
                        file.path || file.data || file,
                        task.upload_url,
                        fileInfo, // 使用文件信息对象而不是简单的Content-Type字符串
                        {
                            onProgress: (progress) => {
                                onProgress?.({
                                    taskId: task.task_id,
                                    progress: progress,
                                    state: 'uploading'
                                });
                            },
                            onSuccess: () => {
                                onUploadSuccess?.({
                                    taskId: task.task_id
                                });
                            }
                        }
                    ).then(() => {
                        console.log("✅ 文件上传完成:", task.upload_url);
                    })
                );
            });
            // 第七步：等待所有文件上传完成
            await Promise.all(uploadPromises);
            console.log("🎉 所有文件上传成功");
            return {
                success: true,
                batch_id: batchResponse.batch_id,
                tasks: uploadTasks,
                file_urls: batchResponse.file_urls,
                task_ids: batchResponse.task_ids
            };
        } catch (error) {
            console.error('❌ 文件上传流程失败:', error.message);
            throw error;
        }
    }

    /**
     * 完整的上传和转换流程
     * 包括文件上传、创建提取任务、监控进度直到完成
     * @param {Array} files - 文件数组
     * @param {Object} options - 配置选项
     * @returns {Promise<Object>} - 包含最终markdown链接的结果
     */
    async uploadAndExtract(files, options = {}) {
        try {
            console.log('🚀 开始完整的上传和转换流程...');
            // 第一步：上传文件到CDN
            const uploadResult = await this.uploadFiles({
                files: files,
                params: options.params || {},
                pageRangeList: options.pageRangeList || [],
                onCreateTaskSuccess: options.onCreateTaskSuccess,
                onProgress: options.onProgress,
                onUploadSuccess: options.onUploadSuccess
            });
            if (!uploadResult.success) {
                throw new Error('文件上传失败');
            }
            console.log('✅ 文件上传完成，检查task_ids...');
            // 第二步：从上传结果中提取task_ids（已在batch API响应中获得）
            const taskIds = uploadResult.tasks.map(task => task.task_id).filter(id => id);

            if (taskIds.length === 0) {
                throw new Error('未获取到有效的task_ids');
            }
            console.log(`✅ 获取到 ${taskIds.length} 个任务ID: ${taskIds.join(', ')}`);
            console.log('🔄 开始监控转换进度...');
            // 第三步：监控进度直到完成
            const completedTasks = await this.progressMonitor.waitForCompletion(
                taskIds,
                {
                    pollInterval: options.pollInterval || 8000,
                    maxWaitTime: options.maxWaitTime || 1800000,
                    onProgress: options.onProgress
                }
            );
            // 第四步：整理结果
            const results = completedTasks.map(task => ({
                task_id: task.task_id,
                file_name: task.file_name,
                state: task.state,
                full_md_link: task.full_md_link,
                layout_url: task.layout_url,
                url: task.url,
                err_msg: task.err_msg
            }));
            const successCount = results.filter(r => r.state === 'done').length;
            const failedCount = results.filter(r => r.state === 'failed' || r.state === 'aborted').length;
            console.log(`🎉 转换流程完成! 成功: ${successCount}, 失败: ${failedCount}`);
            return {
                success: true,
                total: results.length,
                success_count: successCount,
                failed_count: failedCount,
                results: results,
                batch_id: uploadResult.batch_id,
                task_ids: taskIds
            };
        } catch (error) {
            console.error('❌ 完整流程失败:', error.message);
            throw error;
        }
    }

}
// 导出模块
module.exports = {
    FileTypeDetector,
    FileDownloader,
    FilePreprocessor,
    BatchAPIClient,
    CDNFileUploader,
    MineruFileUploader,
    ConcurrencyController,
    TaskProgressMonitor
};
