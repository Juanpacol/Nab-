import Link from 'next/link';
import type { Metadata } from 'next';
import { Card } from '@nab/ui';
import { Logo } from '@/components/logo';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Entrar' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-8">
        <Link href="/">
          <Logo />
        </Link>
        <h1 className="mt-6 font-display text-2xl text-foreground">Bienvenido de vuelta</h1>
        <p className="mt-1 text-sm text-muted">Entra para seguir tu búsqueda.</p>

        <LoginForm />

        <p className="mt-6 text-center text-sm text-muted">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="text-primary hover:underline">
            Regístrate
          </Link>
        </p>
      </Card>
    </main>
  );
}
