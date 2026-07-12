import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = [
  '/dashboard',
  '/feed',
  '/applications',
  '/coach',
  '/profile',
  '/billing',
  '/onboarding',
  '/settings',
];
const AUTH_PAGES = ['/login', '/register'];

/**
 * Protege las rutas del panel: sin sesión (ni access ni refresh) redirige a
 * /login; con sesión, saca al usuario de /login y /register. El refresh real
 * del access token lo hace getCurrentUser() en el servidor.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(
    req.cookies.get('nab_access')?.value || req.cookies.get('nab_refresh')?.value,
  );

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.some((p) => pathname.startsWith(p)) && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/feed/:path*',
    '/applications/:path*',
    '/coach/:path*',
    '/profile/:path*',
    '/billing/:path*',
    '/onboarding/:path*',
    '/settings/:path*',
    '/login',
    '/register',
  ],
};
