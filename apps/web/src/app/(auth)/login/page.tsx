import Link from 'next/link';
import type { Metadata } from 'next';
import { Button, Card } from '@nab/ui';
import { Logo } from '@/components/logo';

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

        {/* Fase 1: conectar con Auth.js (email + Google). UI de andamiaje. */}
        <form className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-foreground" htmlFor="email">
              Correo
            </label>
            <input
              id="email"
              type="email"
              placeholder="tu@correo.com"
              className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-foreground" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
            />
          </div>
          <Button className="w-full" type="submit">
            Entrar
          </Button>
        </form>

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
