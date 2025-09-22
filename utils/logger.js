/**
 * 日志工具模块
 * 提供控制台日志记录功能
 */

class Logger {
    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        if (Object.keys(meta).length > 0) {
            return `[${timestamp}] ${message} ${JSON.stringify(meta)}`;
        }
        return `[${timestamp}] ${message}`;
    }

    info(message, meta = {}) {
        const formatted = this.formatMessage('INFO', message, meta);
        console.log(`ℹ️  ${formatted}`);
    }

    error(message, meta = {}) {
        const formatted = this.formatMessage('ERROR', message, meta);
        console.error(`❌ ${formatted}`);
    }

    warn(message, meta = {}) {
        const formatted = this.formatMessage('WARN', message, meta);
        console.warn(`⚠️  ${formatted}`);
    }

    debug(message, meta = {}) {
        if (process.env.NODE_ENV === 'development') {
            const formatted = this.formatMessage('DEBUG', message, meta);
            console.log(`🐛 ${formatted}`);
        }
    }

    success(message, meta = {}) {
        const formatted = this.formatMessage('SUCCESS', message, meta);
        console.log(`✅ ${formatted}`);
    }
}

module.exports = new Logger();
