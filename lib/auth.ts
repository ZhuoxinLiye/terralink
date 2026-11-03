import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'ef_session';

export function getAuthToken(): string | undefined {
  const cookieStore = cookies();
  return cookieStore.get(JWT_COOKIE_NAME)?.value;
}

export function setAuthCookie(token: string): void {
  const cookieStore = cookies();
  cookieStore.set({
    name: JWT_COOKIE_NAME,
    value: token,
    httpOnly: true,
    // HTTP is used only inside the existing private deployment. Production
    // remains Secure by default; HTTPS deployments should keep the default.
    secure: process.env.JWT_COOKIE_SECURE === 'false'
      ? false
      : process.env.JWT_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  });
}

export function clearAuthCookie(): void {
  const cookieStore = cookies();
  cookieStore.delete(JWT_COOKIE_NAME);
}

export function getAuthTokenFromRequest(request: NextRequest): string | undefined {
  return request.cookies.get(JWT_COOKIE_NAME)?.value;
}
