/**
 * Cookie names for production builds carry the `__Secure-` prefix (ASVS V3.3.1): browsers then accept the
 * cookie only with the Secure flag over HTTPS, so it can't be planted or overwritten from plain HTTP. Every
 * cookie we set is also Secure in production. Delete prefixed cookies with set(name, "", { ...options, maxAge: 0 })
 * using the same options: a bare delete() isn't Secure and the browser ignores it.
 */
export function secureCookieName(base: string, production = process.env.NODE_ENV === "production"): string {
  return production ? `__Secure-${base}` : base;
}
