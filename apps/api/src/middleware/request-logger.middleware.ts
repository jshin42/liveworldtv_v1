import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware for logging HTTP requests and responses
 * Tracks request duration, status codes, and provides request IDs
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'] || 'unknown';
    const requestId = this.generateRequestId();

    // Attach request ID to request object for use in controllers
    (req as any).requestId = requestId;

    const startTime = Date.now();

    // Log incoming request
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(
        `[${requestId}] ${method} ${originalUrl} - ${ip} - ${userAgent}`,
      );
    }

    // Capture response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const contentLength = res.get('content-length') || 0;

      // Determine log level based on status code
      const logLevel = this.getLogLevel(statusCode);
      const message = `[${requestId}] ${method} ${originalUrl} ${statusCode} ${duration}ms - ${contentLength} bytes`;

      // Log with appropriate level
      if (logLevel === 'error') {
        this.logger.error(message);
      } else if (logLevel === 'warn') {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }

      // Log slow requests
      if (duration > 1000) {
        this.logger.warn(
          `[${requestId}] Slow request: ${method} ${originalUrl} took ${duration}ms`,
        );
      }
    });

    next();
  }

  /**
   * Determine log level based on HTTP status code
   */
  private getLogLevel(statusCode: number): 'log' | 'warn' | 'error' {
    if (statusCode >= 500) {
      return 'error';
    }
    if (statusCode >= 400) {
      return 'warn';
    }
    return 'log';
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
