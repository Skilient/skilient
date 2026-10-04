import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui";

export const metadata: Metadata = { title: "Continue", robots: { index: false } };

const COPY: Record<string, { title: string; description: string; action: string }> = {
  recovery: { title: "Reset your password", description: "Continue to choose a new password.", action: "Continue" },
  signup: { title: "Confirm your email", description: "Continue to confirm your university email.", action: "Confirm my email" },
  email: { title: "Confirm your email", description: "Continue to confirm your university email.", action: "Confirm my email" },
  magiclink: { title: "Sign in to Skilient", description: "Continue to sign in on this device.", action: "Sign in" },
  email_change: { title: "Confirm your new email", description: "Continue to confirm the change of email address.", action: "Confirm" },
};

/**
 * Where every email link lands (app/auth/confirm/route.ts redirects here). Nothing is used until the
 * person presses the button: mail scanners open links, but they don't submit forms.
 */
export default async function EmailLinkPage({ searchParams }: PageProps<"/auth/link">) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  const type = typeof params.type === "string" ? params.type : "";
  const copy = COPY[type];

  if (!copy || !/^[A-Za-z0-9_-]{8,200}$/.test(tokenHash)) {
    return (
      <AuthFrame title="This link doesn't work" description="It may be incomplete or out of date. Ask for a new one.">
        <Button asChild size="lg" className="w-full">
          <Link href="/signin">Go to sign in</Link>
        </Button>
      </AuthFrame>
    );
  }
  return (
    <AuthFrame title={copy.title} description={copy.description}>
      <form method="post" action="/auth/confirm">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <Button type="submit" size="lg" className="w-full">
          {copy.action}
        </Button>
      </form>
    </AuthFrame>
  );
}
