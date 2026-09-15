import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/features/auth/auth-store';
import { login } from '@/features/auth/auth-api';
import { loginSchema, type LoginInput } from '@/features/auth/schemas';

export function LoginPage() {
  const status = useAuthStore((s) => s.status);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const mutation = useMutation({
    mutationFn: (input: LoginInput) => login(input.email, input.password),
    meta: { skipGlobalToast: true },
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
      navigate(searchParams.get('next') ?? '/', { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.code === 'AUTH_USER_BLOCKED') {
          setFormError(
            'Tu cuenta está bloqueada. Contacta a un administrador — no reintentes.',
          );
          return;
        }
        if (error.code === 'AUTH_INVALID_CREDENTIALS') {
          setFormError('Email o contraseña incorrectos.');
          return;
        }
      }
      setFormError('No se pudo iniciar sesión. Intenta de nuevo.');
    },
  });

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>
            Plataforma interna de gestión de tickets de soporte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => {
              setFormError(null);
              mutation.mutate(values);
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
