import "server-only";

import { cookies } from "next/headers";
import { secureCookieName } from "@/lib/security/cookie-name";

/** Email awaiting its signup code (httpOnly; keeps the address out of the URL). */
export const VERIFY_COOKIE = secureCookieName("sk_verify");
/** Email waiting for its sign-in code on /signin/code (httpOnly, 15 minutes). */
export const SIGNIN_CODE_COOKIE = secureCookieName("sk_signin_code");
/** Agreement version ticked on /signup before "Continue with Google". */
export const AGREE_COOKIE = secureCookieName("sk_agree");

const base = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export async function setPendingVerification(email: string) {
  (await cookies()).set(VERIFY_COOKIE, email, { ...base, maxAge: 60 * 60 });
}

export async function pendingVerification(): Promise<string | null> {
  const value = (await cookies()).get(VERIFY_COOKIE)?.value ?? null;
  return value && value.includes("@") && value.length <= 254 ? value : null;
}

export async function clearPendingVerification() {
  (await cookies()).set(VERIFY_COOKIE, "", { ...base, maxAge: 0 });
}

export async function setPendingSignInCode(email: string) {
  (await cookies()).set(SIGNIN_CODE_COOKIE, email, { ...base, maxAge: 15 * 60 });
}

export async function pendingSignInCode(): Promise<string | null> {
  const value = (await cookies()).get(SIGNIN_CODE_COOKIE)?.value ?? null;
  return value && value.includes("@") && value.length <= 254 ? value : null;
}

export async function clearPendingSignInCode() {
  (await cookies()).set(SIGNIN_CODE_COOKIE, "", { ...base, maxAge: 0 });
}

export async function setAgreementIntent(version: number) {
  (await cookies()).set(AGREE_COOKIE, String(version), { ...base, maxAge: 15 * 60 });
}

export async function takeAgreementIntent(): Promise<number | null> {
  const store = await cookies();
  const value = store.get(AGREE_COOKIE)?.value;
  if (value) store.set(AGREE_COOKIE, "", { ...base, maxAge: 0 });
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
