import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ApiError } from '@liveworldtv/shared-types';

/**
 * Global exception filter that catches all exceptions and formats them
 * into a consistent API error response format.
 *
 * Handles:
 * - HTTP exceptions (validation errors, not found, etc.)
 * - Database errors (constraint violations, connection errors)
 * - Unexpected errors (500 server errors)
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine HTTP status code
    const status = this.getHttpStatus(exception);

    // Generate request ID for tracking
    const requestId = this.generateRequestId();

    // Build error response
    const errorResponse: ApiError = {
      error: {
        code: this.getErrorCode(exception, status),
        message: this.getErrorMessage(exception, status),
        details: this.getErrorDetails(exception),
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    // Log error with appropriate level
    this.logError(exception, status, requestId, request);

    // Send response
    response.status(status).json(errorResponse);
  }

  /**
   * Determine HTTP status code based on exception type
   */
  private getHttpStatus(exception: Error): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (exception instanceof QueryFailedError) {
      // Database constraint violations
      const error = exception as any;
      if (error.code === '23505') {
        // Unique constraint violation
        return HttpStatus.CONFLICT;
      }
      if (error.code === '23503') {
        // Foreign key constraint violation
        return HttpStatus.BAD_REQUEST;
      }
      // Other database errors
      return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    // Unknown errors default to 500
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Get error code for response
   */
  private getErrorCode(exception: Error, status: number): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && 'error' in response) {
        return (response as any).error;
      }
    }

    // Map status codes to error codes
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_SERVER_ERROR';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'UNKNOWN_ERROR';
    }
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(exception: Error, status: number): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && 'message' in response) {
        const message = (response as any).message;
        // Handle validation error messages (array of strings)
        if (Array.isArray(message)) {
          return message.join(', ');
        }
        return message;
      }
    }

    if (exception instanceof QueryFailedError) {
      const error = exception as any;
      if (error.code === '23505') {
        return 'A record with this value already exists';
      }
      if (error.code === '23503') {
        return 'Referenced record does not exist';
      }
      return 'Database operation failed';
    }

    // Generic messages for status codes
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'The request was invalid or cannot be served';
      case HttpStatus.UNAUTHORIZED:
        return 'Authentication is required';
      case HttpStatus.FORBIDDEN:
        return 'You do not have permission to access this resource';
      case HttpStatus.NOT_FOUND:
        return 'The requested resource was not found';
      case HttpStatus.CONFLICT:
        return 'The request conflicts with the current state';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Too many requests. Please try again later';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'An internal server error occurred';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Service temporarily unavailable';
      default:
        return 'An unexpected error occurred';
    }
  }

  /**
   * Extract additional error details for debugging
   */
  private getErrorDetails(exception: Error): Record<string, any> | undefined {
    // In production, don't expose internal error details
    if (process.env.NODE_ENV === 'production') {
      return undefined;
    }

    // In development, include stack trace and additional info
    const details: Record<string, any> = {};

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object') {
        // Include validation errors
        if ('message' in response && Array.isArray((response as any).message)) {
          details.validationErrors = (response as any).message;
        }
        // Include other response details
        Object.assign(details, response);
      }
    }

    if (exception instanceof QueryFailedError) {
      const error = exception as any;
      details.databaseError = {
        code: error.code,
        detail: error.detail,
        table: error.table,
        constraint: error.constraint,
      };
    }

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
      details.stack = exception.stack;
    }

    return Object.keys(details).length > 0 ? details : undefined;
  }

  /**
   * Log error with appropriate level and context
   */
  private logError(
    exception: Error,
    status: number,
    requestId: string,
    request: Request,
  ) {
    const logContext = {
      requestId,
      method: request.method,
      url: request.url,
      statusCode: status,
      userAgent: request.get('user-agent'),
      ip: request.ip,
    };

    // 5xx errors are actual errors that need investigation
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${exception.message}`,
        exception.stack,
        logContext,
      );
    }
    // 4xx errors are client errors, log as warnings
    else if (status >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} - ${exception.message}`,
        logContext,
      );
    }
    // Other status codes (shouldn't happen in exception filter)
    else {
      this.logger.log(
        `${request.method} ${request.url} - ${exception.message}`,
        logContext,
      );
    }
  }

  /**
   * Generate unique request ID for error tracking
   */
  private generateRequestId(): string {
    return require('crypto').randomBytes(16).toString('hex');
  }
}
