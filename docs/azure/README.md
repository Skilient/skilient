# Skilient on Azure

The backend move off Supabase. One phase, one long-lived branch (`azure`), one cutover.

| File | What it is |
| --- | --- |
| [`prd.md`](prd.md) | The backend PRD: goals and budgets, architecture, service catalogue, data layout, communication, security, operations, cost and capacity, build plan (W0 to W16), implementation plan and cutover, decisions. The source of truth for this move. |
| [`setup-checklist.md`](setup-checklist.md) | What a human must create or export: Azure, Cloudflare, GitHub, Key Vault secrets. Never holds values. |
| [`deploy-status.md`](deploy-status.md) | What exists in Azure now, what is blocked, and the next deploy commands in order. |
| [`workstream-prompts.md`](workstream-prompts.md) | The session prompts for W6 to W10, with the order to run them. |
| `<service>-status.md`, `<service>-function-bins.md` | Per service: what is built and proven, and the tracking sheet of ported functions. |

Related:

- Product spec (unchanged by this move): [`../prd/README.md`](../prd/README.md)
- Decisions, dated: [`../decisions.md`](../decisions.md). The entries from 2026-11-22 record the answers behind this PRD.
- Supabase-era build plan, checklists and code map, kept as history only: [`../archive/supabase-era/`](../archive/supabase-era/)

Status (2026-11-26): W0 to W5 are built on `azure`. Azure holds the foundation without the database (blocked pending a Microsoft support request) and without containers; see `deploy-status.md`.
