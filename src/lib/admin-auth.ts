import { cookies } from "next/headers";
import crypto from "node:crypto";
import { env } from "./env";

const COOKIE = "admin_session";

/** Constant-time compare so the token cannot be guessed by timing. */
function same(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

/**
 * Admin auth. The token now lives in an httpOnly cookie set by a login form,
 * not in the URL — a URL token leaks through browser history, referrers and
 * anything the operator pastes into chat.
 *
 * The ?token= query is still accepted so existing bookmarks keep working.
 */
export async function isAdmin(queryToken?: string): Promise<boolean> {
  const expected = env("ADMIN_TOKEN");
  if (!expected) return false;

  if (queryToken && same(queryToken, expected)) return true;

  const jar = await cookies();
  const cookie = jar.get(COOKIE)?.value;
  return !!cookie && same(cookie, expected);
}

export async function signIn(token: string): Promise<boolean> {
  const expected = env("ADMIN_TOKEN");
  if (!expected || !same(token, expected)) return false;

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}
