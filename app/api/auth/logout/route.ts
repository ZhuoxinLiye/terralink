import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/lib/types';
import { authCookieSecure } from '@/lib/auth';

const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'ef_session';

export async function POST(request: NextRequest) {
  try {
    // Clear the httpOnly cookie
    const response = NextResponse.json({
      success: true,
      data: { message: 'Logout successful' },
    } as ApiResponse);

    response.cookies.set({
      name: JWT_COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: authCookieSecure(),
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/'
    });

    return response;
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse, { status: 500 });
  }
}
