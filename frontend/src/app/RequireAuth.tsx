import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/auth-store';
import type { Role } from '@/types/api';

interface RequireAuthProps {
  children: ReactNode;
  roles?: Role[];
}

export function RequireAuth({ children, roles }: RequireAuthProps) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  const isForbidden = Boolean(
    status === 'authenticated' && roles && user && !roles.includes(user.role),
  );

  useEffect(() => {
    if (isForbidden) {
      toast.error('No tienes acceso a esa sección.');
    }
  }, [isForbidden]);

  if (status === 'unauthenticated') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (isForbidden) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
