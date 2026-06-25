import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function shouldUseSecureCookie(request: Request): boolean {
  const forceSecureCookie = process.env.AUTH_COOKIE_SECURE === "true";
  const forwardedProtoHeader = request.headers.get("x-forwarded-proto") || "";
  const forwardedProto = forwardedProtoHeader.split(",")[0].trim().toLowerCase();
  const isHttpsRequest = forwardedProto === "https" || new URL(request.url).protocol === "https:";
  return forceSecureCookie || isHttpsRequest;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.set("auth_token", "", {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json(
    { success: true },
    {
      headers: AUTH_NO_STORE_HEADERS,
    }
  );
}
