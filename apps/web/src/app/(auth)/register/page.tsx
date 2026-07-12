import Link from 'next/link';
import type { Metadata } from 'next';
import { Card } from '@nab/ui';
import { Logo } from '@/components/logo';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-8">
        <Link href="/">
          <Logo />
        </Link>
        <h1 className="mt-6 font-display text-2xl text-foreground">Crea tu cuenta</h1>
        <p className="mt-1 text-sm text-muted">5 aplicaciones gratis. Sin tarjeta.</p>

        <RegisterForm />

        <p className="mt-6 text-center text-sm text-muted">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Entra
          </Link>
        </p>
      </Card>
    </main>
  );
}
