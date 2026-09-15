import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';

interface ErrorResponseBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details: unknown;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AppException) {
      const status = exception.getStatus();
      const body: ErrorResponseBody = {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      };
      response.status(status).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message = this.extractValidationMessage(exceptionResponse);

      const body: ErrorResponseBody = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message,
          details:
            typeof exceptionResponse === 'object'
              ? (exceptionResponse as Record<string, unknown>)['message']
              : null,
        },
      };
      response.status(status).json(body);
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : exception,
    );
    const body: ErrorResponseBody = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocurrió un error inesperado.',
        details: null,
      },
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }

  private extractValidationMessage(exceptionResponse: unknown): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }
    if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      const { message } = exceptionResponse as { message: unknown };
      if (Array.isArray(message)) {
        return message.join(', ');
      }
      if (typeof message === 'string') {
        return message;
      }
    }
    return 'Solicitud inválida.';
  }
}
