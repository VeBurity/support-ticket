import { useAuthStore } from '@/features/auth/auth-store';
import type { ErrorCode } from '@/types/api';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  code: ErrorCode;
  details: unknown;

  constructor(code: ErrorCode, message: string, details: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiFailure {
  success: false;
  error: { code: ErrorCode; message: string; details: unknown };
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return null;
        const body = (await res.json()) as ApiSuccess<{ accessToken: string }>;
        return body.data.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuthRetry?: boolean;
}

async function performRequest<T>(
  path: string,
  options: RequestOptions,
): Promise<{ res: Response; parsed: ApiSuccess<T> | ApiFailure }> {
  const { accessToken } = useAuthStore.getState();
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const parsed = (await res.json().catch(() => null)) as
    | ApiSuccess<T>
    | ApiFailure
    | null;

  if (!parsed) {
    throw new ApiError('INTERNAL_ERROR', 'Respuesta inválida del servidor.');
  }

  return { res, parsed };
}

export async function apiFetchEnvelope<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiSuccess<T>> {
  const { res, parsed } = await performRequest<T>(path, options);

  if (parsed.success) {
    return parsed;
  }

  const { code, message, details } = parsed.error;

  if (res.status === 401 && code === 'AUTH_USER_BLOCKED') {
    useAuthStore.getState().clear();
    throw new ApiError(code, message, details);
  }

  if (res.status === 401 && code === 'AUTH_TOKEN_EXPIRED' && !options.skipAuthRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      useAuthStore.getState().setAccessToken(newToken);
      const retry = await performRequest<T>(path, {
        ...options,
        skipAuthRetry: true,
      });
      if (retry.parsed.success) {
        return retry.parsed;
      }
      throw new ApiError(
        retry.parsed.error.code,
        retry.parsed.error.message,
        retry.parsed.error.details,
      );
    }
    useAuthStore.getState().clear();
  }

  throw new ApiError(code, message, details);
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const envelope = await apiFetchEnvelope<T>(path, options);
  return envelope.data;
}
