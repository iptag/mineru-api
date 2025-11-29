import os
import json
import requests
from pathlib import Path

# --- 配置部分 ---
# 输入目录：存放 PDF 文件的文件夹
INPUT_DIR = r'D:\paper\教育学论文'
# 输出目录：存放 Markdown 文件的文件夹
OUTPUT_DIR = r'D:\paper\教育学论文\md'
# API 地址：Docker 容器映射的地址 (根据您的 docker run -p 7917:8000)
API_URL = 'http://100.80.150.48:7917/api/convert'
# ----------------

def convert_pdf_to_md():
    # 1. 确保输出目录存在
    output_path = Path(OUTPUT_DIR)
    if not output_path.exists():
        try:
            output_path.mkdir(parents=True, exist_ok=True)
            print(f"已创建输出目录: {OUTPUT_DIR}")
        except Exception as e:
            print(f"无法创建输出目录: {e}")
            return

    # 2. 获取所有 PDF 文件
    input_path = Path(INPUT_DIR)
    if not input_path.exists():
        print(f"错误: 输入目录不存在: {INPUT_DIR}")
        return

    pdf_files = list(input_path.glob('*.pdf'))
    
    if not pdf_files:
        print(f"在 {INPUT_DIR} 中未找到 PDF 文件。")
        return

    print(f"共找到 {len(pdf_files)} 个 PDF 文件，准备开始转换...")
    print(f"API 地址: {API_URL}\n")

    success_count = 0
    fail_count = 0

    # 3. 遍历处理
    for index, pdf_file in enumerate(pdf_files, 1):
        print(f"[{index}/{len(pdf_files)}] 正在处理: {pdf_file.name}")
        
        # 检查目标 Markdown 文件是否已存在
        md_filename = pdf_file.stem + '.md'
        target_file = output_path / md_filename
        if target_file.exists():
            print(f"   ℹ️  目标文件 '{md_filename}' 已存在，跳过转换。")
            # 严格来说这不算失败，但我们不增加成功计数，可以将其视为“未处理”或“跳过”
            # 为保持计数逻辑清晰，这里不修改 success_count 或 fail_count
            continue
        
        try:
            # 准备文件和参数
            # mode='rb' 以二进制模式读取
            with open(pdf_file, 'rb') as f:
                files = {
                    'file': (pdf_file.name, f, 'application/pdf')
                }
                
                # 转换选项
                options = {
                    "is_ocr": False,       # 如果是扫描件图片，改为 True
                    "enable_formula": True, # 启用公式识别
                    "enable_table": True,   # 启用表格识别
                }
                
                # 将 options 转换为 JSON 字符串发送
                data = {
                    'options': json.dumps(options)
                }

                # 发送 POST 请求
                # timeout 设置较大，因为大文件转换可能需要时间
                response = requests.post(API_URL, files=files, data=data, timeout=600)

            # 4. 处理响应
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    # 获取 Markdown 内容
                    md_content = result['data'].get('markdownContent')

                    # 如果没有直接返回内容，尝试从 markdownUrl 下载
                    if not md_content:
                        md_url = result['data'].get('markdownUrl')
                        if md_url:
                            print(f"   📥 从 URL 下载 Markdown 内容...")
                            try:
                                md_response = requests.get(md_url, timeout=60)
                                if md_response.status_code == 200:
                                    md_content = md_response.text
                                else:
                                    print(f"   ⚠️  下载失败，状态码: {md_response.status_code}")
                            except Exception as e:
                                print(f"   ⚠️  下载异常: {str(e)}")

                    if md_content:
                        # 构建输出文件名 (.pdf -> .md)
                        md_filename = pdf_file.stem + '.md'
                        target_file = output_path / md_filename
                        
                        # 写入 Markdown 文件
                        with open(target_file, 'w', encoding='utf-8') as f_out:
                            f_out.write(md_content)
                        
                        print(f"   ✅ 转换成功! 已保存: {md_filename}")
                        success_count += 1
                    else:
                        print("   ⚠️  API 返回成功，但没有 Markdown 内容。")
                        fail_count += 1
                else:
                    error_msg = result.get('message', '未知错误')
                    print(f"   ❌ API 错误: {error_msg}")
                    fail_count += 1
            else:
                print(f"   ❌ HTTP 请求失败: 状态码 {response.status_code}")
                print(f"   响应内容: {response.text[:200]}") # 打印前200个字符用于调试
                fail_count += 1

        except requests.exceptions.ConnectionError:
            print(f"   ❌ 连接失败: 无法连接到 {API_URL}")
            print("   请检查 Docker 容器是否正在运行 (docker ps)。")
            fail_count += 1
        except Exception as e:
            print(f"   ❌ 处理异常: {str(e)}")
            fail_count += 1

    # 5. 总结
    print(f"\n{'='*30}")
    print(f"处理完成!")
    print(f"成功: {success_count}")
    print(f"失败: {fail_count}")
    print(f"输出目录: {OUTPUT_DIR}")
    print(f"{'='*30}")

if __name__ == '__main__':
    convert_pdf_to_md()
