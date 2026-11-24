/** `/livez` answers while the process runs; `/readyz` while every check passes and the process is not draining. */
export interface Health {
  add(name: string, check: () => Promise<boolean>): void;
  drain(): void;
  ready(): Promise<{ ok: boolean; checks: Record<string, boolean> }>;
}

export function createHealth(timeoutMs = 1_000): Health {
  const checks = new Map<string, () => Promise<boolean>>();
  let draining = false;
  return {
    add: (name, check) => void checks.set(name, check),
    drain: () => void (draining = true),
    async ready() {
      const results: Record<string, boolean> = { draining: !draining };
      await Promise.all(
        [...checks].map(async ([name, check]) => {
          const timeout = new Promise<boolean>((resolve) => setTimeout(resolve, timeoutMs, false).unref());
          results[name] = await Promise.race([check().catch(() => false), timeout]);
        }),
      );
      return { ok: Object.values(results).every(Boolean), checks: results };
    },
  };
}
