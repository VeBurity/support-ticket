import { HttpException } from '@nestjs/common';
import { ErrorCode, ERROR_HTTP_STATUS } from './error-codes';

export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details: unknown = null,
  ) {
    super({ code, message, details }, ERROR_HTTP_STATUS[code]);
  }
}
