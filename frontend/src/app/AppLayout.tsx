import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/features/auth/auth-store';
import { logout as logoutRequest } from '@/features/auth/auth-api';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Dashboard', roles: null },
  { to: '/tickets', label: 'Tickets', roles: null },
  { to: '/users', label: 'Usuarios', roles: ['ADMIN'] as const },
];

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();

  const logoutMutation = useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      clear();
      navigate('/login', { replace: true });
    },
    meta: { skipGlobalToast: true },
  });

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">Soporte</span>
            <nav className="flex gap-1">
              {navItems
                .filter((item) => !item.roles || (user && item.roles.includes(user.role as never)))
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted',
                        isActive && 'bg-muted text-foreground',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {user && (
              <span className="text-muted-foreground">
                {user.name} · {user.role}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              Salir
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
