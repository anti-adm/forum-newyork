import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // пути, доступные без логина
  const publicPaths = ["/login", "/api/auth/login", "/api/auth/2fa-verify"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // читаем куку авторизации
  // сначала auth_token (та, что точно выставляется сейчас),
  // если её нет — пытаемся взять старую majestic_admin_token
  const token =
    req.cookies.get("auth_token")?.value ??
    req.cookies.get("majestic_admin_token")?.value;

  // если токена нет → редирект на логин
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api/public).*)"],
};