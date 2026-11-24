# Skilient on Azure

The backend move off Supabase. One phase, one long-lived branch (`azure`), one cutover.

| File | What it is |
| --- | --- |
| [`prd.md`](prd.md) | The backend PRD: goals and budgets, architecture, service catalogue, data layout, communication, security, operations, cost and capacity, build plan (W0 to W16), implementation plan and cutover, decisions. The source of truth for this move. |
| [`setup-checklist.md`](setup-checklist.md) | What a human must create or export: Azure, Cloudflare, GitHub, Key Vault secrets. Never holds values. |

Related:

- Product spec (unchanged by this move): [`../prd/README.md`](../prd/README.md)
- Decisions, dated: [`../decisions.md`](../decisions.md). The entries from 2026-11-22 record the answers behind this PRD.
- Supabase-era build plan, checklists and code map, kept as history only: [`../archive/supabase-era/`](../archive/supabase-era/)

Status: the PRD and this folder are on the local branch `azure`. Nothing is committed or pushed yet. Azure resources have not been created.
