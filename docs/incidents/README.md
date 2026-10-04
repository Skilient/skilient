# Incidents

Postmortems live here, one file per incident: `YYYY-MM-DD-short-name.md` (phase 13 question 14). Severity follows
PRD 10 "Observability": a data breach is always Sev 1. For a breach, contain first, then tell affected users within
72 hours what happened and what they should do.

Stopping an account during an incident: `/ops/sanctions`, or `docs/emergency-ban.md` if `/ops` is down.

## Template

```markdown
# <What happened, in one line>

- Severity: Sev 1 | 2 | 3
- Detected: <date time PKT>, by <alert / person / report>
- Resolved: <date time PKT>
- People affected: <who and how many>; told on <date> (breach: within 72 hours)

## Timeline (PKT)

## What went wrong

## What we changed

## What we'll change next (owner, date)
```
