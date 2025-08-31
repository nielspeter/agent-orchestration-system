/**
 * SecureLogger - Provides logging with automatic redaction of sensitive data
 * 
 * Automatically redacts:
 * - API keys
 * - Bearer tokens
 * - Authorization headers
 * - Sensitive environment variables
 */
export class SecureLogger {
  private static readonly REDACTION_PATTERNS = [
    // API Keys (Anthropic format: sk-ant-api03-...)
    { pattern: /sk-ant-[A-Za-z0-9\-]{40,}/g, replacement: 'sk-ant-...[REDACTED]' },
    { pattern: /sk-[A-Za-z0-9\-]{40,}/g, replacement: 'sk-...[REDACTED]' },
    { pattern: /anthropic-[A-Za-z0-9\-]{40,}/g, replacement: 'anthropic-...[REDACTED]' },
    
    // Bearer tokens
    { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, replacement: 'Bearer [REDACTED]' },
    
    // Authorization headers
    { pattern: /"authorization":\s*"[^"]+"/gi, replacement: '"authorization": "[REDACTED]"' },
    { pattern: /"x-api-key":\s*"[^"]+"/gi, replacement: '"x-api-key": "[REDACTED]"' },
    
    // Environment variables
    { pattern: /ANTHROPIC_API_KEY=[^\s]+/g, replacement: 'ANTHROPIC_API_KEY=[REDACTED]' },
  ];

  /**
   * Redacts sensitive information from a string
   */
  static redact(text: string): string {
    let redacted = text;
    
    for (const { pattern, replacement } of this.REDACTION_PATTERNS) {
      redacted = redacted.replace(pattern, replacement);
    }
    
    return redacted;
  }

  /**
   * Logs a message with automatic redaction
   */
  static log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    const redactedMessage = this.redact(message);
    const redactedArgs = args.map(arg => {
      if (typeof arg === 'string') {
        return this.redact(arg);
      }
      if (typeof arg === 'object' && arg !== null) {
        return this.redactObject(arg);
      }
      return arg;
    });

    switch (level) {
      case 'debug':
        console.debug(redactedMessage, ...redactedArgs);
        break;
      case 'info':
        console.info(redactedMessage, ...redactedArgs);
        break;
      case 'warn':
        console.warn(redactedMessage, ...redactedArgs);
        break;
      case 'error':
        console.error(redactedMessage, ...redactedArgs);
        break;
    }
  }

  /**
   * Recursively redacts sensitive data from objects
   */
  private static redactObject(obj: any, depth = 0, maxDepth = 10): any {
    if (depth > maxDepth) return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => {
        if (typeof item === 'string') {
          return this.redact(item);
        }
        if (typeof item === 'object' && item !== null) {
          return this.redactObject(item, depth + 1, maxDepth);
        }
        return item;
      });
    }

    if (typeof obj === 'object' && obj !== null) {
      const redacted: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        // Redact entire value for sensitive keys
        if (this.isSensitiveKey(key)) {
          redacted[key] = '[REDACTED]';
        } else if (typeof value === 'string') {
          redacted[key] = this.redact(value);
        } else if (typeof value === 'object' && value !== null) {
          redacted[key] = this.redactObject(value, depth + 1, maxDepth);
        } else {
          redacted[key] = value;
        }
      }
      
      return redacted;
    }

    return obj;
  }

  /**
   * Checks if a key name indicates sensitive data
   */
  private static isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'apikey',
      'api_key',
      'x-api-key',
      'authorization',
      'bearer',
      'token',
      'secret',
      'password',
      'credentials',
      'anthropic_api_key'
    ];
    
    const lowerKey = key.toLowerCase();
    return sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
  }

  // Convenience methods
  static debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  static info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  static warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  static error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }
}