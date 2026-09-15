import { useEffect, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/features/auth/auth-store';
import { refresh, me } from '@/features/auth/auth-api';

function AuthBootstrap({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const setSession = useAuthStore((s) => s.setSession);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const clear = useAuthStore((s) => s.clear);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { accessToken } = await refresh();
        setAccessToken(accessToken);
        const user = await me();
        if (!cancelled) {
          setSession(accessToken, user);
        }
      } catch {
        if (!cancelled) {
          clear();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'idle') {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthBootstrap>{children}</AuthBootstrap>
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
