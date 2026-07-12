import Link from 'next/link';
import type { Metadata } from 'next';
import { Button, Card } from '@nab/ui';
import { Logo } from '@/components/logo';

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

        {/* Fase 1: conectar con Auth.js. UI de andamiaje. */}
        <form className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-foreground" htmlFor="name">
              Nombre
            </label>
            <input
              id="name"
              type="text"
              className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
            />
          </div>
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
            Crear cuenta
          </Button>
        </form>

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
