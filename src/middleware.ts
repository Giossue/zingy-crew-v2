import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyClientToken } from '@/lib/auth/jwt';
// Nota: La sesión de NextAuth para el Admin se maneja típicamente envolviendo el middleware
// o verificando el token de NextAuth.js directamente aquí.

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Proteger Rutas del Cliente (/client/*)
    if (pathname.startsWith('/client') && !pathname.includes('/login') && !pathname.includes('/register')) {
        const token = request.cookies.get('zingy_client_session')?.value;

        if (!token) {
            return NextResponse.redirect(new URL('/client/login', request.url));
        }

        const validPayload = await verifyClientToken(token);
        if (!validPayload) {
            const response = NextResponse.redirect(new URL('/client/login', request.url));
            response.cookies.delete('zingy_client_session');
            return response;
        }
    }

    // 2. Proteger Rutas del Admin (/admin/*)
    if (pathname.startsWith('/admin') && !pathname.includes('/login')) {
        // Para NextAuth v5, buscaremos la cookie de sesión estándar
        const adminSession = request.cookies.get('authjs.session-token') || request.cookies.get('__Secure-authjs.session-token');

        if (!adminSession) {
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }
    }

    return NextResponse.next();
}

// Optimización: Solo ejecutar el middleware en rutas protegidas
export const config = {
    matcher: ['/client/:path*', '/admin/:path*'],
};