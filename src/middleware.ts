// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 👇 1) Разрешаем боту ходить в /api/forum/* без куки/логина
  if (pathname.startsWith("/api/forum/")) {
    return NextResponse.next();
  }

  // 2) Пути, доступные без логина обычным пользователям
  const publicPaths = ["/login", "/api/auth/login", "/api/auth/2fa-verify"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 3) Проверяем куку авторизации
  const token =
    req.cookies.get("auth_token")?.value ??
    req.cookies.get("majestic_admin_token")?.value;

  // если токена нет → редирект на /login
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 4) Всё ок — пускаем дальше
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api/public).*)"],
};