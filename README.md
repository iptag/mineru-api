# MinerU API Server

基于 [MinerU](https://mineru.net/OpenSourceTools/Extractor/) 的网页在线文档转换服务提取为api格式，支持 PDF、Word 文档、图片转换为 Markdown 格式。

## ✨ 特性

- 🔄 **多格式支持**: PDF、Word (.doc/.docx)、图片 (.jpg/.png/.gif/.bmp/.tiff/.webp)
- 📝 **Markdown 输出**: 高质量的 Markdown 格式转换
- 🔍 **OCR 识别**: 支持图片和扫描文档的文字识别
- 📊 **表格识别**: 智能识别和转换表格结构
- 🧮 **公式识别**: 支持数学公式的识别和转换
- 🔤 **中文文件名支持**: 自动修复中文文件名编码问题，支持UTF-8乱码和URL编码修复
- 🐳 **Docker 部署**: 一键部署，开箱即用
- 🛡️ **安全可靠**: 文件类型验证、大小限制、速率限制
- 📈 **监控友好**: 健康检查、结构化日志、错误处理
- 🔥 **配置热重载**: 修改 `config.json` 后无需重启，配置即可自动生效

## ⚠ 风险警告

- 此项目属于研究交流学习性质，不接受任何资金捐助和金钱交易！
- 仅限自用和个人研究，避免对官方造成服务压力，否则轻者可能封号，重者可能触犯法律！
- 仅限自用和个人研究，避免对官方造成服务压力，否则轻者可能封号，重者可能触犯法律！
- 仅限自用和个人研究，避免对官方造成服务压力，否则轻者可能封号，重者可能触犯法律！

## 🚀 快速开始

### 配置文件设置

首先需要配置认证token。项目提供了配置文件模板：

```bash
# 复制配置文件模板
cp config.example.json config.json

# 编辑配置文件，替换authToken
nano config.json  # 或使用其他编辑器
```

配置文件内容：
```json
{
  "mineru": {
    "authToken": "Bearer your-auth-token-here",
    "baseURL": "https://mineru.org.cn/api/v4",
    "timeout": 30000,
    "maxConcurrency": 6
  }
}
```

**重要**:
- 请将 `authToken` 中 `your-auth-token-here` 的替换为您的有效token
-  `token`获取方法：登录MinerU后，f12随便打开一个js文件，获取Cookie中的uaa-token=后面的字符串，到第一个;截至，不要复制多了
- token可能会定期过期，需要及时更新config.json文件

### 使用 Docker（推荐）

```bash
# 1. 克隆项目
git clone <repository-url>
cd mineru-api

# 2. 配置认证token
# 编辑 config.json 文件，替换其中的 authToken

# 3. 构建Docker镜像
docker build -t mineru-api .

# 4. 创建输出目录（可选）
mkdir -p output

# 5. 运行容器
docker run -d \
  --name mineru-api \
  -p 8000:8000 \
  -v /root/mineru/config.json:/app/config.json \
  -v /root/mineru/output:/app/output \
  --restart unless-stopped \
  mineru-api

# 6. 查看容器状态
docker ps

# 7. 查看日志
docker logs -f mineru-api

# 8. 停止容器
docker stop mineru-api

# 9. 删除容器
docker rm mineru-api
```

### 健康检查

容器启动后，可以通过以下命令检查服务状态：

```bash
# 检查容器健康状态
docker inspect --format='{{.State.Health.Status}}' mineru-api

# 测试API接口
curl http://localhost:8000/health
```

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置认证token
# 编辑 config.json 文件，替换其中的 authToken

# 3. 启动服务
npm start

# 4. 测试服务
curl http://localhost:8000/health
```

## 📖 API 文档

### 基础信息

- **Base URL**: `http://localhost:8000`
- **Content-Type**: `multipart/form-data` (文件上传)
- **最大文件大小**: PDF(100MB), Word(50MB), 图片(20MB)

### 端点列表

#### 1. 健康检查

```http
GET /health
```

**响应示例**:
```json
{
  "success": true,
  "message": "MinerU API Server is running",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600
}
```

#### 2. 支持的文件类型

```http
GET /api/supported-types
```

**响应示例**:
```json
{
  "success": true,
  "message": "支持的文件类型信息",
  "data": {
    "extensions": [".pdf", ".doc", ".docx", ".jpg", ".png", "..."],
    "description": "PDF文档(.pdf)、Word文档(.doc, .docx)、图片文件(.jpg, .jpeg, .png, .gif, .bmp, .tiff, .webp)",
    "maxFileSizes": {
      "PDF": "100MB",
      "WORD": "50MB", 
      "IMAGE": "20MB"
    }
  }
}
```

#### 3. 文档转换

```http
POST /api/convert
```

**请求参数**:
- `file` (required): 要转换的文件
- `options` (optional): JSON 字符串格式的转换选项

**转换选项**:
```json
{
  "is_ocr": false,           // 是否启用OCR（图片推荐true）
  "enable_formula": true,    // 是否识别数学公式
  "enable_table": true,      // 是否识别表格
  "language": "zh-CN",       // 语言设置
  "is_chem": false          // 是否为化学文档
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "文档转换成功",
  "data": {
    "filename": "document.pdf",
    "fileType": "PDF",
    "taskId": "task_123456",
    "markdownUrl": "https://cdn.example.com/result.md",
    "layoutUrl": "https://cdn.example.com/layout.json"
  }
}
```

## 💻 使用示例

### cURL 示例

```bash
# 转换 PDF 文档
curl -X POST http://localhost:8000/api/convert \
  -F "file=@document.pdf" \
  -F 'options={"enable_formula":true,"enable_table":true}'

# 转换图片（启用OCR）
curl -X POST http://localhost:8000/api/convert \
  -F "file=@image.png" \
  -F 'options={"is_ocr":true}'
```

### JavaScript 示例

```javascript
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function convertDocument(filePath) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  formData.append('options', JSON.stringify({
    is_ocr: false,
    enable_formula: true,
    enable_table: true
  }));

  try {
    const response = await axios.post('http://localhost:8000/api/convert', formData, {
      headers: formData.getHeaders(),
      timeout: 1800000 // 30分钟
    });
    
    console.log('转换成功:', response.data);
    return response.data;
  } catch (error) {
    console.error('转换失败:', error.response?.data || error.message);
    throw error;
  }
}
```

### Python 示例

```python
import requests

def convert_document(file_path, options=None):
    url = 'http://localhost:8000/api/convert'
    
    files = {'file': open(file_path, 'rb')}
    data = {}
    
    if options:
        data['options'] = json.dumps(options)
    
    try:
        response = requests.post(url, files=files, data=data, timeout=1800)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'转换失败: {e}')
        raise
    finally:
        files['file'].close()

# 使用示例
result = convert_document('document.pdf', {
    'enable_formula': True,
    'enable_table': True
})
print(f'Markdown URL: {result["data"]["markdownUrl"]}')
```

## 🔧 配置

### 配置文件 (config.json)

项目使用 `config.json` 文件进行配置，主要包含MinerU API相关设置：

```json
{
  "mineru": {
    "authToken": "Bearer your-auth-token-here",
    "baseURL": "https://mineru.org.cn/api/v4",
    "timeout": 30000,
    "maxConcurrency": 6
  }
}
```

**配置项说明**:

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `authToken` | MinerU API认证token（必需） | 无 |
| `baseURL` | MinerU API基础URL | `https://mineru.org.cn/api/v4` |
| `timeout` | API请求超时时间（毫秒） | `30000` |
| `maxConcurrency` | 最大并发上传数量 | `6` |

**重要提示**:
- `authToken` 是必需的，请确保使用有效的token
- token可能会定期过期，需要及时更新config.json文件
- 配置文件优先级：构造函数参数 > config.json > 默认值

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `8000` | 服务端口 |
| `NODE_ENV` | `development` | 运行环境 |
| `RATE_LIMIT` | `10` | 速率限制（每15分钟） |
| `ALLOWED_ORIGINS` | `*` | 允许的跨域来源 |

### Docker 运行配置

```bash
# 基础运行
docker run -d \
  --name mineru-api \
  -p 8000:8000 \
  -v $(pwd)/config.json:/app/config.json \
  mineru-api

# 生产环境配置
docker run -d \
  --name mineru-api \
  -p 8000:8000 \
  -e NODE_ENV=production \
  -e RATE_LIMIT=20 \
  -e ALLOWED_ORIGINS=https://yourdomain.com \
  -v $(pwd)/config.json:/app/config.json \
  -v $(pwd)/output:/app/output \
  --restart unless-stopped \
  mineru-api
```

## 🧪 测试

```bash
# 运行测试脚本
npm test

# 或直接运行
node examples/test-api.js
```

## 📝 日志

所有日志输出到控制台，包含时间戳、级别和消息信息。

查看日志：
```bash
# Docker容器日志
docker logs -f mineru-api

# 本地开发日志
npm start  # 直接在终端查看
```

## 🔤 中文文件名支持

### 自动编码修复

本项目内置了中文文件名编码修复功能，可以自动处理以下编码问题：

#### 支持的编码问题类型

1. **UTF-8乱码修复**
   ```
   原始文件名: 鲁迅真的会带坏青少年吗?.pdf
   乱码显示: é²è¿ççä¼å¸¦åéå°å¹´åï¼.pdf
   自动修复: 鲁迅真的会带坏青少年吗?.pdf ✅
   ```

2. **URL编码修复**
   ```
   URL编码: %E9%B2%81%E8%BF%85%E7%9C%9F%E7%9A%84.pdf
   自动修复: 鲁迅真的.pdf ✅
   ```

3. **编码占位符处理**
   ```
   问号占位符: ????.pdf
   处理方式: 保持原样或尝试其他编码方式
   ```

#### 工作原理

- **自动检测**: 上传时自动检测文件名编码问题
- **智能修复**: 使用多种编码方式尝试修复
- **日志记录**: 修复过程会记录在日志中
- **向后兼容**: 不影响正常的英文或正确编码的中文文件名

## 🛠️ 故障排除

### 常见问题

1. **文件上传失败**
   - 检查文件大小是否超限
   - 确认文件类型是否支持
   - 查看服务器日志获取详细错误信息

2. **转换超时**
   - 增加 `MINERU_TIMEOUT` 环境变量
   - 检查网络连接
   - 尝试转换较小的文件

3. **Docker 容器无法启动**
   - 检查端口是否被占用
   - 确认 Docker 版本
   - 检查配置文件是否正确挂载
   - 查看容器日志: `docker logs mineru-api`

4. **认证失败**
   - 检查 config.json 中的 authToken 是否有效
   - 确认 token 是否已过期
   - 验证配置文件格式是否正确

### 监控

- 健康检查: `GET /health`
- 容器状态: `docker ps`
- 实时日志: `docker logs -f mineru-api`
- 配置验证: 检查容器启动日志中的配置加载信息

## 📄 许可证

MIT License