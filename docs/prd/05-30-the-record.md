### 5.30 The Record (decided 2026-11-02)

The Record is a student's **second transcript**: a signed, verifiable co-curricular record. Every event attended, office-bearer term, competition placing, volunteer hour, completed venture, skill swap taught and proof task done becomes an **entry** that anyone can check at `/verify/[code]`, and that the student can print as one signed transcript next to the academic one.

**Why it matters.** Pakistani students collect co-curricular certificates for CVs, scholarships and applications abroad, but today they are Canva PDFs that anyone can fake, so nobody trusts them. The Record replaces them.

**Why every student signs up.** Issuers issue **only through Skilient**: the entry *is* the certificate, and there is no PDF outside the student's account. A 300-person society event means 300 students who need an account to receive theirs. Societies can add attendees by university email, which sends a claim email (flow 3 below).

#### Issuers and entry kinds

Issuers are **verified societies** (5.31) and **Skilient itself**. Faculty and outside organisations do not issue at launch (decisions 2026-11-02).

| Kind | Issuer | Issued when | Evidence line (example) |
| --- | --- | --- | --- |
| Attended | Society | Event close-out, from check-ins (5.31) | "Checked in 10:04" |
| Completed | Society | Multi-session event, attended at least N of M sessions | "3 of 4 sessions" |
| Result | Society | The host enters placings at close-out | "2nd of 14 teams" |
| Office bearer | Society | The president confirms the term at term end; a second officer confirms the president's own term | "General Secretary · Sep 2025 – Jun 2026" |
| Volunteer | Society | An officer logs hours per person per activity, capped at the activity's length | "6 h · Blood drive" |
| Venture completed | Skilient | Venture completion (`venture_completions`) | "Team of 4 · completed 12 Oct 2026" |
| Taught (skill swap) | Skilient | A swap closes with learner-confirmed sessions (5.32) | "3 sessions · 4.5 h · confirmed by Hira" |
| Proof task | Skilient | A proof task is verified (5.32) | "Verified by GitHub" or "Confirmed by a peer" |

Rules:
- **Only verified societies issue.** A suspended society can't issue; entries it already issued stay unless revoked.
- **No officer issues to themselves alone.** Any entry naming the issuing officer needs a second officer's confirmation.
- **Every entry is immutable once signed.** A correction issues a new entry and the old code reads "Superseded by <code>".
- **Revocation** (the issuing society's officers, or staff) needs a reason, is audited, notifies the student with the reason, and can be appealed through the existing appeals flow (5.26).
- **The Record does not change rank** in formula v1 (5.13). Revisit in formula v2 (question 1).
- Entries can be reported (5.12).

#### Activity flow

1. **An entry arrives.**
   - Sources: an event close-out, a term confirmation, a venture completion, a closed skill swap or a verified proof task.
   - The row shows **Signing…**, then **Sealed · 14:06** with its code.
   - The student is notified ("New on your Record: Attended Build with React · CS Society · 12 Nov 2026").
2. **`/me/record`**, the ledger:
   - a Spectral heading "Your Record"
   - stat tiles by kind in tabular mono
   - rows grouped by academic year (September to August) and filterable by kind
   - each row: the issuer's avatar, title, date, evidence line, seal and code
3. **Claim** (someone not on Skilient yet):
   - A host adds an attendee by university email (walk-in or late add, 5.31). The entry is held against that address.
   - Skilient sends **one** claim email per person per event: "Your entry for <event> is waiting".
   - The person signs up through the normal university-email gate (5.27). Onboarding ends on "N entries waiting" → **Claim** → the entries join the Record.
   - The address must match the verified email exactly. Unclaimed entries expire after 180 days (question 2).
   - The claim email links to `/auth/link`-style pages that scanners can't consume (decisions 2026-10-04).
4. **Entry actions:**
   - Pin to the profile (3 highlights at most); hide from the profile (it stays on the Record).
   - Download a signed certificate PDF with a QR code. The student downloads it from their account only.
   - Copy the verify link.
   - **Report a mistake** to the issuer → an officer corrects it → a new entry, with the old one superseded.
5. **Share the whole Record:**
   - A share link with an expiry, revocable, at `/record/[username]?t=` (the `cv_share_links` pattern; token hash only).
   - Or download the **transcript PDF**: signed, every entry not hidden, a QR code to the verify page.
6. **CV.** In `/me/cv` the student picks entries for a "Leadership and activities" section (question 4). The CV's evidence rule (decisions 2026-10-19) holds: the CV prints the entry plainly and the verify page carries the evidence.
7. **Verify.** `/verify/[code]` shows the entry, issuer, date, evidence, signature check and status (valid, revoked with date, or superseded with the new code).
8. **Empty state.** The ledger-book render, "Your first entry is one event away", and the next event the student can register for.

#### Build: The Record

- **Tables.**
  - `record_entries`: id, user_id or claim_email_hash, kind, issuer_type (society or skilient), issuer_id, source (event, session, term, venture, swap, task) and source_id, title, evidence jsonb, issued_at, signed_at, code, status (pending, sealed, revoked, superseded), superseded_by, revoked_reason, hidden, pinned.
  - `record_share_links`: token hash only.
  - `record_claims`: email hash, entry, expires_at, sent_at.
  - RLS: the owner reads their entries; issuers read what they issued; everything else goes through functions.
- **Signing.**
  - A new envelope kind `record_entry` (`RecordEntryV1` in `lib/record/types.ts`) signed by the `cv-sign` Edge Function with the existing Vault key and RFC 8785 canonical JSON (`_shared/cv/canonical.ts`, `sign.ts`).
  - Issuance is batched through a pgmq queue `record_jobs`, following `cv_jobs`.
  - Codes share the `/verify/[code]` namespace; the verify page branches on kind.
- **PDFs.**
  - Certificate and transcript built on `lib/cv/pdf.ts` and `lib/cv/browser.ts`, stored in the private `cv-exports` bucket pattern with a MAC check (`record_cv_export`).
  - Spectral for the heading, Space Grotesk for the body, mono for codes.
- **Claim.** A `private.handle_new_user` hook moves held entries whose email hash matches the verified email. The `notify-worker` kind `record_claim` sends the email.
- **Jobs.** `record-claims-expire` runs nightly; issuing runs every minute from `record_jobs`.
- **Done when:**
  - a check-in at a verified society's event produces a sealed entry that verifies at `/verify/[code]`, and a revoked one shows revoked
  - an officer can't issue to themselves without a second officer
  - a claim email turns into entries after signup with the same address and never with a different one
  - the transcript PDF verifies every entry on it
  - pgTAP refuses every cross-user read
