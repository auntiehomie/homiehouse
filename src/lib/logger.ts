/**
 * Centralized logging utilities
 */

/**
 * API request logger with consistent formatting
 */
export class ApiLogger {
  constructor(private context: string) {}

  /**
   * Log request start
   */
  start(metadata?: Record<string, any>): void {
    console.log(`[${this.context}] ========== REQUEST START ==========`);
    if (metadata) {
      this.info('Request metadata', this.sanitize(metadata));
    }
  }

  /**
   * Log request end
   */
  end(metadata?: Record<string, any>): void {
    if (metadata) {
      this.info('Response metadata', this.sanitize(metadata));
    }
    console.log(`[${this.context}] ========== REQUEST END ==========`);
  }

  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    if (data !== undefined) {
      console.log(`[${this.context}] ${message}:`, this.sanitize(data));
    } else {
      console.log(`[${this.context}] ${message}`);
    }
  }

  /**
   * Log success message
   */
  success(message: string, data?: any): void {
    if (data !== undefined) {
      console.log(`[${this.context}] ✅ ${message}:`, this.sanitize(data));
    } else {
      console.log(`[${this.context}] ✅ ${message}`);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any): void {
    if (data !== undefined) {
      console.warn(`[${this.context}] ⚠️ ${message}:`, this.sanitize(data));
    } else {
      console.warn(`[${this.context}] ⚠️ ${message}`);
    }
  }

  /**
   * Log error message
   */
  error(message: string, error?: any): void {
    console.error(`[${this.context}] ❌ ${message}`);
    
    if (error) {
      if (process.env.NODE_ENV === 'production') {
        // In production, only log safe error info
        console.error(`[${this.context}] Error details:`, {
          name: error?.name,
          message: error?.message,
          code: error?.code,
          status: error?.status,
        });
      } else {
        // In development, log full error
        console.error(`[${this.context}] Full error:`, error);
      }
    }
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, data?: any): void {
    if (process.env.NODE_ENV !== 'production') {
      if (data !== undefined) {
        console.debug(`[${this.context}] 🐛 ${message}:`, data);
      } else {
        console.debug(`[${this.context}] 🐛 ${message}`);
      }
    }
  }

  /**
   * Sanitize data for logging - remove sensitive fields
   */
  private sanitize(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password',
      'apiKey',
      'api_key',
      'apikey',
      'token',
      'secret',
      'mnemonic',
      'privateKey',
      'private_key',
      'authorization',
      'auth',
    ];

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      // Check if field name contains sensitive keywords
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 100) {
        // Truncate long strings
        sanitized[key] = value.substring(0, 100) + '...';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

/**
 * Create a logger for a specific API route
 */
export function createApiLogger(routeName: string): ApiLogger {
  return new ApiLogger(`API ${routeName}`);
}

/**
 * Performance logging utility
 */
export class PerformanceLogger {
  private startTime: number;
  private checkpoints: Map<string, number> = new Map();

  constructor(private context: string) {
    this.startTime = Date.now();
  }

  /**
   * Mark a checkpoint
   */
  checkpoint(name: string): void {
    const elapsed = Date.now() - this.startTime;
    this.checkpoints.set(name, elapsed);
    
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[${this.context}] Checkpoint "${name}": ${elapsed}ms`);
    }
  }

  /**
   * Log total duration
   */
  end(): void {
    const totalDuration = Date.now() - this.startTime;
    
    if (process.env.NODE_ENV !== 'production' || totalDuration > 3000) {
      // Always log slow requests
      console.log(`[${this.context}] Total duration: ${totalDuration}ms`);
      
      if (this.checkpoints.size > 0) {
        console.log(`[${this.context}] Checkpoints:`, Object.fromEntries(this.checkpoints));
      }
    }
  }
}
