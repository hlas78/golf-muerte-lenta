import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth/verify",
  "/api/auth",
  "/_next",
  "/favicon",
  "/logo.png",
];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  if (isPublic) {
    return NextResponse.next();
  }

  const token = request.cookies.get("gml_token")?.value;
  if (!token) {
    const magicToken = request.nextUrl.searchParams.get("token");
    if (magicToken) {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = "/auth/verify";
      verifyUrl.searchParams.set("token", magicToken);
      const nextUrl = request.nextUrl.clone();
      nextUrl.searchParams.delete("token");
      verifyUrl.searchParams.set(
        "next",
        `${nextUrl.pathname}${nextUrl.search}`
      );
      return NextResponse.redirect(verifyUrl);
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/health).*)"],
};
