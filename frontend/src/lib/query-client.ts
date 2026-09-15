import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client';
import { messageForError } from '@/lib/error-messages';

function handleError(error: unknown, meta?: Record<string, unknown> | undefined) {
  if (meta?.skipGlobalToast) {
    return;
  }
  if (error instanceof ApiError) {
    if (
      error.code === 'AUTH_TOKEN_EXPIRED' ||
      error.code === 'AUTH_TOKEN_INVALID'
    ) {
      return;
    }
    toast.error(messageForError(error.code, error.message));
    return;
  }
  toast.error('Ocurrió un error inesperado. Intenta de nuevo.');
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => handleError(error, query.meta),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => handleError(error, mutation.meta),
  }),
});
