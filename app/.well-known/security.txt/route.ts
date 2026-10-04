import { siteUrl } from "@/lib/cv/site";
import { securityTxt } from "@/lib/security/security-txt";

export const dynamic = "force-static";

export function GET() {
  return new Response(securityTxt(siteUrl()), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" },
  });
}
