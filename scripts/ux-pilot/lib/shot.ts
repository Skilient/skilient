/** Screenshots to docs/ux-pilot/shots/<id>-<n>.png (phone shots unless asked). Keeps a running count. */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import type { Page } from "@playwright/test";

const DIR = "docs/ux-pilot/shots";
const counters = new Map<string, number>();

export async function shot(page: Page, id: string, opts: { fullPage?: boolean } = {}): Promise<string> {
  mkdirSync(DIR, { recursive: true });
  let n = counters.get(id) ?? 0;
  do n++;
  while (existsSync(`${DIR}/${id}-${n}.png`) && !counters.has(id));
  counters.set(id, n);
  const path = `${DIR}/${id}-${n}.png`;
  await page.screenshot({ path, fullPage: opts.fullPage ?? false, animations: "disabled" }).catch(() => undefined);
  return path;
}

export function shotCount(): number {
  return existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".png")).length : 0;
}
