/**
 * MinerU API Server 测试脚本
 * 演示如何使用 API 接口进行文档转换
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// API 服务器地址
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

/**
 * 测试健康检查接口
 */
async function testHealthCheck() {
    try {
        console.log('🔍 测试健康检查接口...');
        const response = await axios.get(`${API_BASE_URL}/health`);
        console.log('✅ 健康检查成功:', response.data);
        return true;
    } catch (error) {
        console.error('❌ 健康检查失败:', error.message);
        return false;
    }
}

/**
 * 测试支持的文件类型接口
 */
async function testSupportedTypes() {
    try {
        console.log('\n🔍 测试支持的文件类型接口...');
        const response = await axios.get(`${API_BASE_URL}/api/supported-types`);
        console.log('✅ 支持的文件类型:', response.data.data.description);
        console.log('📋 文件扩展名:', response.data.data.extensions.join(', '));
        return true;
    } catch (error) {
        console.error('❌ 获取支持的文件类型失败:', error.message);
        return false;
    }
}

/**
 * 测试文档转换接口
 * @param {string} filePath - 测试文件路径
 * @param {object} options - 转换选项
 */
async function testConvertDocument(filePath, options = {}) {
    try {
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            console.error(`❌ 测试文件不存在: ${filePath}`);
            return false;
        }

        console.log(`\n🔍 测试文档转换: ${path.basename(filePath)}`);
        
        // 创建表单数据
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));
        
        // 添加转换选项
        if (Object.keys(options).length > 0) {
            formData.append('options', JSON.stringify(options));
        }

        // 发送请求
        const response = await axios.post(`${API_BASE_URL}/api/convert`, formData, {
            headers: {
                ...formData.getHeaders()
            },
            timeout: 1800000, // 30分钟超时
            maxContentLength: 100 * 1024 * 1024, // 100MB
            maxBodyLength: 100 * 1024 * 1024
        });

        if (response.data.success) {
            console.log('✅ 文档转换成功!');
            console.log(`📄 文件名: ${response.data.data.filename}`);
            console.log(`📋 文件类型: ${response.data.data.fileType}`);
            console.log(`🆔 任务ID: ${response.data.data.taskId}`);
            console.log(`🔗 Markdown链接: ${response.data.data.markdownUrl}`);
            
            if (response.data.data.layoutUrl) {
                console.log(`📐 布局文件: ${response.data.data.layoutUrl}`);
            }
            
            if (response.data.data.markdownContent) {
                console.log(`📝 Markdown内容长度: ${response.data.data.markdownContent.length} 字符`);
            }
            
            return true;
        } else {
            console.error('❌ 文档转换失败:', response.data.message);
            return false;
        }

    } catch (error) {
        console.error('❌ 文档转换请求失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
        return false;
    }
}

/**
 * 主测试函数
 */
async function runTests() {
    console.log('🚀 开始 MinerU API Server 测试...\n');
    
    let passedTests = 0;
    let totalTests = 0;

    // 测试1: 健康检查
    totalTests++;
    if (await testHealthCheck()) {
        passedTests++;
    }

    // 测试2: 支持的文件类型
    totalTests++;
    if (await testSupportedTypes()) {
        passedTests++;
    }

    // 测试3: 文档转换 - PDF
    const testFiles = [
        // 在这里添加你的测试文件路径
        '../mineru/111.pdf',
        '../mineru/111.docx',
        '../mineru/111.png'
    ];

    for (const filePath of testFiles) {
        const fullPath = path.resolve(__dirname, filePath);
        if (fs.existsSync(fullPath)) {
            totalTests++;
            
            // 根据文件类型设置不同的转换选项
            let options = {};
            const ext = path.extname(fullPath).toLowerCase();
            
            if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'].includes(ext)) {
                // 图片文件启用 OCR
                options = {
                    is_ocr: true,
                    enable_formula: true,
                    enable_table: true
                };
            } else {
                // 文档文件
                options = {
                    is_ocr: false,
                    enable_formula: true,
                    enable_table: true,
                    language: 'zh-CN'
                };
            }
            
            if (await testConvertDocument(fullPath, options)) {
                passedTests++;
            }
        } else {
            console.log(`⚠️ 跳过测试文件（不存在）: ${filePath}`);
        }
    }

    // 输出测试结果
    console.log(`\n📊 测试完成: ${passedTests}/${totalTests} 通过`);
    
    if (passedTests === totalTests) {
        console.log('🎉 所有测试通过!');
        process.exit(0);
    } else {
        console.log('❌ 部分测试失败');
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    runTests().catch(error => {
        console.error('❌ 测试过程中发生错误:', error);
        process.exit(1);
    });
}

module.exports = {
    testHealthCheck,
    testSupportedTypes,
    testConvertDocument,
    runTests
};
