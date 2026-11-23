/**
 * UX pilot browser contexts (docs/ux-pilot/). Phone = 390x844, touch, Fast 3G and 4x CPU through CDP;
 * Desktop = 1280x800. Local stack only: refuses a base URL or Supabase URL that isn't 127.0.0.1/localhost.
 */
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

export const BASE = process.env.UXP_BASE ?? "http://127.0.0.1:3100";
for (const u of [BASE, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1"]) {
  const h = new URL(u).hostname;
  if (h !== "127.0.0.1" && h !== "localhost") throw new Error(`ux-pilot: refused non-local target ${u}`);
}

export type Device = "phone" | "desktop";
export interface Ctx {
  device: Device;
  colorScheme?: "light" | "dark";
  reducedMotion?: "reduce" | "no-preference";
  throttle?: boolean;
  /** CSS font scale for "largest text" probes (1 = default). */
  textScale?: number;
}

export interface Account {
  email: string;
  password: string;
  fullName: string;
  username: string;
  id: string;
  totpSecret?: string;
}
export function accounts(): { password: string; accounts: Record<string, Account>; ids: Record<string, any> } {
  return JSON.parse(readFileSync("docs/ux-pilot/accounts.local.json", "utf8"));
}

export async function launch(): Promise<Browser> {
  return chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
}

const THROTTLE = { offline: false, latency: 562.5, downloadThroughput: (1.6 * 1024 * 1024 * 0.9) / 8, uploadThroughput: (750 * 1024 * 0.9) / 8 };

export async function context(browser: Browser, c: Ctx): Promise<BrowserContext> {
  const phone = c.device === "phone";
  const ctx = await browser.newContext({
    baseURL: BASE,
    viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    isMobile: phone,
    hasTouch: phone,
    userAgent: phone
      ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
      : undefined,
    colorScheme: c.colorScheme ?? "dark",
    reducedMotion: c.reducedMotion ?? "no-preference",
    timezoneId: "Asia/Karachi",
    locale: "en-PK",
  });
  if (c.textScale && c.textScale !== 1) {
    await ctx.addInitScript((scale) => {
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.style.fontSize = `${16 * scale}px`;
      });
    }, c.textScale);
  }
  (ctx as any).__uxp = c;
  return ctx;
}

/** A page with the context's throttling applied (phone defaults to throttled). */
export async function page(ctx: BrowserContext): Promise<Page> {
  const p = await ctx.newPage();
  const c: Ctx = (ctx as any).__uxp ?? { device: "desktop" };
  if (c.throttle ?? c.device === "phone") {
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", THROTTLE);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  p.setDefaultTimeout(30_000);
  p.setDefaultNavigationTimeout(60_000);
  return p;
}

export function totp(secret: string, now = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(ch);
    if (v !== -1) bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const h = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

/** Signs in through the form as a seeded account (two-factor for staff). */
export async function signIn(p: Page, who: Account): Promise<void> {
  await p.goto("/signin");
  await p.getByLabel("University email").fill(who.email);
  await p.getByLabel("Password", { exact: true }).fill(who.password);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL((u) => u.pathname !== "/signin", { timeout: 60_000 });
  if (p.url().includes("/signin/mfa") && who.totpSecret) {
    await p.locator("input").first().fill(totp(who.totpSecret));
    const btn = p.getByRole("button", { name: /verify|continue|sign in/i }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click();
    await p.waitForURL((u) => !u.pathname.startsWith("/signin"), { timeout: 60_000 });
  }
}

/** A signed-in page for one seeded account. */
export async function as(browser: Browser, key: string, c: Ctx): Promise<Page> {
  const ctx = await context(browser, c);
  const p = await page(ctx);
  await signIn(p, accounts().accounts[key]);
  return p;
}

/** Waits until the page is interactive (network idle: the client bundle has loaded and hydrated). */
export async function ready(p: Page, extraMs = 300): Promise<void> {
  await p.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => undefined);
  if (extraMs) await p.waitForTimeout(extraMs);
}
