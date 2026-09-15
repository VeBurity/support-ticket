import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((result) => {
        if (result && typeof result === 'object' && 'data' in result) {
          const { data, meta } = result as {
            data: T;
            meta?: Record<string, unknown>;
          };
          return meta !== undefined
            ? { success: true, data, meta }
            : { success: true, data };
        }
        return { success: true, data: result as T };
      }),
    );
  }
}
