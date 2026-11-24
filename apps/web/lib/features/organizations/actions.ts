"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { actionContext } from "@/lib/actions/context";
import { rpcAction } from "@/lib/actions/recruit-run";
import { fail, type ActionResult } from "@/lib/actions/result";
import { call, NO_SESSION, signedIn } from "@/lib/actions/rpc";
import { sha256Hex } from "@/lib/data/recruit-public";
import { sendEmail } from "@/lib/email/send";
import { orgInviteEmail } from "@/lib/email/templates";
import { ORG_SIZES } from "@/lib/recruit/constants";

const uuid = z.uuid();
const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label}: at least ${min} characters.`).max(max, `${label}: at most ${max} characters.`);

const orgSchema = z.object({
  name: text(2, 80, "Company name"),
  website: z.string().trim().regex(/^https:\/\/\S+$/, "Enter the website starting with https://").max(200),
  industry: text(2, 60, "Industry"),
  size: z.enum(ORG_SIZES, { error: "Pick the company size." }),
  city: text(2, 60, "City"),
  signerRole: text(2, 60, "Your role"),
  linkedinUrl: z.union([z.literal(""), z.string().trim().regex(/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/\S+$/, "Enter a LinkedIn page address.")]),
  registrationNumber: z.string().trim().max(60, "At most 60 characters."),
});
export type OrgInput = z.input<typeof orgSchema>;

export async function createOrganization(input: OrgInput): Promise<ActionResult<string>> {
  return rpcAction<typeof orgSchema, string>({
    name: "recruit.create_org",
    schema: orgSchema,
    input,
    fn: "create_organization",
    args: (v) => ({
      p: {
        name: v.name,
        website: v.website,
        industry: v.industry,
        size: v.size,
        city: v.city,
        signer_role: v.signerRole,
        linkedin_url: v.linkedinUrl,
        registration_number: v.registrationNumber,
      },
    }),
    revalidate: ["/recruit", "/org/join"],
  });
}

const companySchema = z.object({
  about: z.string().trim().max(1500, "Keep the about text under 1,500 characters."),
  locations: z.array(text(2, 60, "Location")).max(10, "Up to 10 locations."),
  industry: text(2, 60, "Industry"),
  size: z.enum(ORG_SIZES),
  linkedinUrl: orgSchema.shape.linkedinUrl,
});
export async function updateCompanyPage(input: z.input<typeof companySchema>): Promise<ActionResult> {
  return rpcAction({
    name: "recruit.update_company",
    schema: companySchema,
    input,
    fn: "update_company_page",
    args: (v) => ({ p: { about: v.about, locations: v.locations, industry: v.industry, size: v.size, linkedin_url: v.linkedinUrl } }),
    revalidate: ["/org/settings", "/recruit"],
  });
}

// ---------------------------------------------------------------------------
// Members and invites (the token is generated here, emailed, and only its hash is stored)
// ---------------------------------------------------------------------------
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address.")),
  role: z.enum(["admin", "recruiter", "billing"]),
});
export async function inviteMember(input: z.input<typeof inviteSchema>): Promise<ActionResult<{ link: string; emailed: boolean }>> {
  const ctx = await actionContext("recruit.invite_member");
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    ctx.done("refused", { error_code: "invalid_input" });
    return fail("invalid_input", parsed.error.issues[0]?.message ?? "Check the email address.");
  }
  const session = await signedIn(ctx);
  if (!session) return NO_SESSION;
  const token = randomBytes(32).toString("base64url");
  const result = await call<string>(ctx, session.supabase, session.userId, "invite_org_member", {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_token_hash: sha256Hex(token),
  }, ["/org/members"]);
  if (!result.ok) return result;
  const { data: org } = await session.supabase.rpc("my_org");
  const orgName = (org as { name?: string } | null)?.name ?? "your company";
  const link = `${ctx.origin}/signup/recruiter?invite=${token}`;
  const emailed = await sendEmail(orgInviteEmail(parsed.data.email, { orgName, role: parsed.data.role, link }), ctx.requestId);
  // The admin who made the invite also gets the link, to paste if the email is slow or unconfigured.
  return { ok: true, data: { link, emailed } };
}

export async function revokeInvite(id: string): Promise<ActionResult> {
  return rpcAction({ name: "recruit.revoke_invite", schema: uuid, input: id, fn: "revoke_org_invite", args: (v) => ({ p_id: v }), revalidate: ["/org/members"] });
}
export async function acceptInvite(id: string): Promise<ActionResult> {
  return rpcAction({ name: "recruit.accept_invite", schema: uuid, input: id, fn: "accept_org_invite", args: (v) => ({ p_id: v }), revalidate: ["/recruit", "/org/join", "/org/members"] });
}
export async function setMemberRole(userId: string, role: "admin" | "recruiter" | "billing"): Promise<ActionResult> {
  return rpcAction({
    name: "recruit.set_member_role",
    schema: z.object({ userId: uuid, role: z.enum(["admin", "recruiter", "billing"]) }),
    input: { userId, role },
    fn: "set_org_member_role",
    args: (v) => ({ p_user: v.userId, p_role: v.role }),
    revalidate: ["/org/members"],
  });
}
export async function removeMember(userId: string): Promise<ActionResult> {
  return rpcAction({ name: "recruit.remove_member", schema: uuid, input: userId, fn: "remove_org_member", args: (v) => ({ p_user: v }), revalidate: ["/org/members"] });
}
