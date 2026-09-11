import { NextResponse } from "next/server";
import { checkPassword, COOKIE_NAME, createSessionToken } from "@/lib/auth/session";

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };

  if (typeof password !== "string" || !checkPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
