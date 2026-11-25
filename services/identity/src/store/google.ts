import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { refuse } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";

/**
 * Google sign-in (PRD 5.27: university Google accounts only). The web app sends the authorization code and
 * its PKCE verifier; identity exchanges them at Google's token endpoint, verifies the id_token's signature
 * against Google's published keys, its issuer and its audience (our client id), and only then trusts the
 * address. No Google API beyond sign-in is used (openid, email, profile).
 */
type Tx = postgres.TransactionSql;

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  jwksUrl: string;
  issuer: string;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
}

const Claims = z.object({
  sub: z.string().min(1).max(255),
  email: z.string().min(3).max(320),
  email_verified: z.literal(true),
  name: z.string().max(200).optional(),
});

/** One verifier per configuration: jose caches Google's keys and refetches them on an unknown key id. */
export function googleVerifier(config: GoogleConfig, doFetch: typeof fetch = fetch) {
  let keys: JWTVerifyGetKey | undefined;
  const issuers = [config.issuer, config.issuer.replace(/^https:\/\//, "")];
  return async function exchange(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<GoogleProfile> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
    const res = await doFetch(config.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body,
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!res) throw refuse("unavailable", "google_unavailable");
    if (!res.ok) throw refuse("not_signed_in", "google_exchange_failed");
    const token = ((await res.json().catch(() => ({}))) as { id_token?: unknown }).id_token;
    if (typeof token !== "string") throw refuse("not_signed_in", "google_exchange_failed");
    keys ??= createRemoteJWKSet(new URL(config.jwksUrl), { timeoutDuration: 5000 });
    const verified = await jwtVerify(token, keys, { issuer: issuers, audience: config.clientId, algorithms: ["RS256"] }).catch(() => null);
    if (!verified) throw refuse("not_signed_in", "google_token_invalid");
    const claims = Claims.safeParse(verified.payload);
    if (!claims.success) throw refuse("not_signed_in", "google_email_unverified");
    return { sub: claims.data.sub, email: claims.data.email.trim().toLowerCase(), name: claims.data.name?.trim() || null };
  };
}

/** The account a Google identity belongs to, or the account with that verified address (to link it). */
export async function findGoogleAccount(tx: Tx, profile: GoogleProfile): Promise<{ userId: string; linked: boolean } | null> {
  const [byIdentity] = await tx<{ user_id: string }[]>`
    select user_id from identity.identities where provider = 'google' and provider_user_id = ${profile.sub} for update`;
  if (byIdentity) return { userId: byIdentity.user_id, linked: true };
  const [byEmail] = await tx<{ id: string }[]>`select id from identity.users where email = ${profile.email} for update`;
  return byEmail ? { userId: byEmail.id, linked: false } : null;
}

/** Links a Google identity to an account (Google verified the address, so it also confirms it). */
export async function linkGoogle(tx: Tx, userId: string, profile: GoogleProfile): Promise<void> {
  const done = await tx`
    insert into identity.identities (provider, provider_user_id, user_id, email_at_link, last_used_at)
    values ('google', ${profile.sub}, ${userId}, ${profile.email}, now())
    on conflict do nothing`;
  // The account already has another Google identity: one per account.
  if (done.count !== 1) throw refuse("conflict", "google_already_linked");
  await tx`update identity.users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = ${userId}`;
}

export async function touchGoogle(tx: Tx, profile: GoogleProfile): Promise<void> {
  await tx`update identity.identities set last_used_at = now() where provider = 'google' and provider_user_id = ${profile.sub}`;
}
