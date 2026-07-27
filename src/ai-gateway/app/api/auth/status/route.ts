import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { logger } from '@/shared/utils/logger';const SECRET = process.env.JWT_SECRET ? new TextEncoder().encode(process.env.JWT_SECRET) : null;
const AUTH_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function authJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...AUTH_NO_STORE_HEADERS,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token || !SECRET) {
      return authJson({ authenticated: false });
    }

    await jwtVerify(token, SECRET);
    return authJson({ authenticated: true });
  } catch (error: unknown) {logger.warn('[route] string operation failed', error);
    return authJson({ authenticated: false });
  }
}
