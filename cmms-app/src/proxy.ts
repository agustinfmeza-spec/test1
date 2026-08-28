import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PATHS = ["/login"];

/**
 * Proxy (reemplazo de `middleware.ts` en esta versión de Next) para el chequeo
 * "optimista" de sesión a nivel de página: redirige a /login si no hay sesión,
 * y aleja de /login si ya la hay. La autorización real (roles, dueño del
 * recurso) se revalida siempre en cada Route Handler — este chequeo es solo UX.
 */
export default auth((req) => {
  const isPublic = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
  const isLoggedIn = !!req.auth;

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
