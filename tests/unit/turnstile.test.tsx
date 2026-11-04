// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TurnstileStatus } from "@/components/auth/turnstile";

/**
 * The signup human check (components/auth/turnstile.tsx) against a fake Cloudflare: no network, the
 * script tag is answered by hand. Covers: a solved check gives the form a token; until then the form
 * refuses to submit; a script or widget failure says so and offers Try again; an expired or used token
 * needs a fresh check; Try again brings the widget back.
 */
type Options = Record<string, unknown> & { callback: (t: string) => void; "expired-callback": () => void; "error-callback": () => void };

let widgets: Options[];
let resets: number;
const fake = {
  render: (_el: HTMLElement, options: Record<string, unknown>) => {
    widgets.push(options as Options);
    return `w${widgets.length}`;
  },
  reset: () => {
    resets += 1;
  },
  remove: () => undefined,
};

function script(): HTMLScriptElement | null {
  return document.head.querySelector('script[src*="challenges.cloudflare.com"]');
}

async function setup() {
  vi.resetModules();
  const mod = await import("@/components/auth/turnstile");
  const tokens: (string | null)[] = [];
  const statuses: TurnstileStatus[] = [];
  const view = (resetKey = 0) => (
    <mod.Turnstile siteKey="1x00000000000000000000AA" action="signup" resetKey={resetKey} onToken={(t) => tokens.push(t)} onStatus={(s) => statuses.push(s)} />
  );
  const utils = render(view());
  return { mod, tokens, statuses, rerender: (key: number) => utils.rerender(view(key)) };
}

async function loadScript() {
  window.turnstile = fake;
  await act(async () => {
    script()!.dispatchEvent(new Event("load"));
  });
}

beforeEach(() => {
  widgets = [];
  resets = 0;
  delete window.turnstile;
  for (const el of document.head.querySelectorAll("script")) el.remove();
});

afterEach(() => {
  cleanup();
});

describe("Turnstile on signup", () => {
  it("a solved check hands the form a token, and the form may submit", async () => {
    const { mod, tokens, statuses } = await setup();
    await loadScript();
    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({ sitekey: "1x00000000000000000000AA", action: "signup" });
    act(() => widgets[0].callback("token-1"));
    expect(tokens.at(-1)).toBe("token-1");
    expect(statuses.at(-1)).toBe("verified");
    expect(mod.humanCheckBlock("site", "token-1", "verified")).toBeNull();
  });

  it("while the check is pending the form refuses to submit", async () => {
    const { mod, tokens, statuses } = await setup();
    expect(statuses.at(-1)).toBe("pending");
    expect(tokens.filter(Boolean)).toEqual([]);
    expect(mod.humanCheckBlock("site", null, "pending")).toMatch(/Wait a moment/);
    // Without a site key (local, CI) there is no check to wait for.
    expect(mod.humanCheckBlock(null, null, "pending")).toBeNull();
  });

  it("a script that fails to load says so and offers Try again, which brings the widget back", async () => {
    const { mod, statuses, tokens } = await setup();
    await act(async () => {
      script()!.dispatchEvent(new Event("error"));
    });
    expect(statuses.at(-1)).toBe("failed");
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't run the check that you're human");
    expect(mod.humanCheckBlock("site", null, "failed")).toMatch(/Try again/);
    expect(script()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(script()).not.toBeNull();
    await loadScript();
    expect(screen.queryByRole("alert")).toBeNull();
    act(() => widgets[0].callback("token-2"));
    expect(tokens.at(-1)).toBe("token-2");
    expect(statuses.at(-1)).toBe("verified");
  });

  it("a widget error says so too, and Try again renders a fresh widget", async () => {
    const { statuses } = await setup();
    await loadScript();
    act(() => widgets[0]["error-callback"]());
    expect(statuses.at(-1)).toBe("failed");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(widgets).toHaveLength(2);
    expect(screen.queryByRole("alert")).toBeNull();
    act(() => widgets[1].callback("token-3"));
    expect(statuses.at(-1)).toBe("verified");
  });

  it("an expired token is dropped until the check passes again", async () => {
    const { tokens, statuses } = await setup();
    await loadScript();
    act(() => widgets[0].callback("token-4"));
    act(() => widgets[0]["expired-callback"]());
    expect(tokens.at(-1)).toBeNull();
    expect(statuses.at(-1)).toBe("pending");
    act(() => widgets[0].callback("token-5"));
    expect(tokens.at(-1)).toBe("token-5");
  });

  it("after a submit (a used token) the widget resets and the form needs a fresh token", async () => {
    const { tokens, statuses, rerender } = await setup();
    await loadScript();
    act(() => widgets[0].callback("token-6"));
    act(() => rerender(1));
    expect(resets).toBe(1);
    expect(tokens.at(-1)).toBeNull();
    expect(statuses.at(-1)).toBe("pending");
  });
});
