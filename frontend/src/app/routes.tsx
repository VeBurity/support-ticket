import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/app/AppLayout';
import { RequireAuth } from '@/app/RequireAuth';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { TicketsListPage } from '@/features/tickets/TicketsListPage';
import { TicketDetailPage } from '@/features/tickets/TicketDetailPage';
import { UsersPage } from '@/features/users/UsersPage';

function NotFoundPage() {
  return (
    <div className="flex min-h-svh items-center justify-center text-muted-foreground">
      Página no encontrada.
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tickets" element={<TicketsListPage />} />
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
        <Route
          path="/users"
          element={
            <RequireAuth roles={['ADMIN']}>
              <UsersPage />
            </RequireAuth>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
