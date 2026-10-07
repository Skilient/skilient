Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# endorsements

## private.endorsable_skill(p_venture uuid, p_user uuid, p_skill text)

[src: supabase/migrations/20261001000000_endorsements.sql#endorsable_skill]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.endorsable_skill(p_venture uuid, p_user uuid, p_skill text) | sql | true | search_path="" | None | 20261001000000_endorsements.sql |

## private.endorsement_limit(p_name text)

[src: supabase/migrations/20261001000000_endorsements.sql#endorsement_limit]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.endorsement_limit(p_name text) | sql | true | search_path="" | None | 20261001000000_endorsements.sql |

## private.endorsements_changed()

[src: supabase/migrations/20261001000000_endorsements.sql#endorsements_changed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.endorsements_changed() | plpgsql | true | search_path="" | None | 20261001000000_endorsements.sql |

## private.hide_endorsement(p_id uuid, p_hidden boolean)

[src: supabase/migrations/20261001000000_endorsements.sql#hide_endorsement]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.hide_endorsement(p_id uuid, p_hidden boolean) | plpgsql | true | search_path="" | authenticated | 20261001000000_endorsements.sql |

## private.pk_month_start()

[src: supabase/migrations/20261001000000_endorsements.sql#pk_month_start]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.pk_month_start() | sql | false | search_path="" | None | 20261001000000_endorsements.sql |

## private.prompt_endorsements()

[src: supabase/migrations/20261001000000_endorsements.sql#prompt_endorsements]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.prompt_endorsements() | plpgsql | true | search_path="" | None | 20261001000000_endorsements.sql |

## public.endorse(p_endorsee uuid, p_venture uuid, p_items jsonb, p_note text)

[src: supabase/migrations/20261001000000_endorsements.sql#endorse]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.endorse(p_endorsee uuid, p_venture uuid, p_items jsonb, p_note text) | sql | false | search_path="" | authenticated, service_role | 20261001000000_endorsements.sql |

## public.endorse_options(p_venture uuid)

[src: supabase/migrations/20261001000000_endorsements.sql#endorse_options]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.endorse_options(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20261001000000_endorsements.sql |

## public.hide_endorsement(p_id uuid, p_hidden boolean)

[src: supabase/migrations/20261001000000_endorsements.sql#hide_endorsement]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.hide_endorsement(p_id uuid, p_hidden boolean) | sql | false | search_path="" | authenticated, service_role | 20261001000000_endorsements.sql |

## public.endorsements

[src: supabase/migrations/20261001000000_endorsements.sql#endorsements]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| endorser_id | uuid | true | — |  |  | — |
| endorsee_id | uuid | true | — |  |  | — |
| venture_id | uuid | true | — |  |  | — |
| skill_id | text | true | — |  |  | "default" |
| evidence_id | uuid | false | — |  |  | — |
| note | text | false | — |  |  | "default" |
| hidden | boolean | true | false |  |  | — |
| hidden_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| endorser_kind | text | true | 'peer'::text |  |  | "default" |

### Keys and constraints

```sql
endorsements_check: CHECK (endorser_id <> endorsee_id); -- validated: true
```

```sql
endorsements_check1: CHECK (hidden = (hidden_at IS NOT NULL)); -- validated: true
```

```sql
endorsements_endorsee_id_fkey: FOREIGN KEY (endorsee_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
endorsements_endorser_id_endorsee_id_skill_id_venture_id_key: UNIQUE (endorser_id, endorsee_id, skill_id, venture_id); -- validated: true
```

```sql
endorsements_endorser_id_fkey: FOREIGN KEY (endorser_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
endorsements_endorser_kind_check: CHECK (endorser_kind = ANY (ARRAY['peer'::text, 'teacher'::text])); -- validated: true
```

```sql
endorsements_evidence_id_fkey: FOREIGN KEY (evidence_id) REFERENCES contributions(id) ON DELETE SET NULL; -- validated: true
```

```sql
endorsements_note_check: CHECK (note IS NULL OR char_length(note) >= 1 AND char_length(note) <= 280); -- validated: true
```

```sql
endorsements_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
endorsements_skill_id_fkey: FOREIGN KEY (skill_id) REFERENCES skills(id); -- validated: true
```

```sql
endorsements_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX endorsements_endorsee_idx ON public.endorsements USING btree (endorsee_id, skill_id); -- valid: true
```

```sql
CREATE INDEX endorsements_endorser_created_idx ON public.endorsements USING btree (endorser_id, created_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX endorsements_endorser_id_endorsee_id_skill_id_venture_id_key ON public.endorsements USING btree (endorser_id, endorsee_id, skill_id, venture_id); -- valid: true
```

```sql
CREATE INDEX endorsements_evidence_idx ON public.endorsements USING btree (evidence_id) WHERE (evidence_id IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX endorsements_pkey ON public.endorsements USING btree (id); -- valid: true
```

```sql
CREATE INDEX endorsements_skill_idx ON public.endorsements USING btree (skill_id); -- valid: true
```

```sql
CREATE INDEX endorsements_venture_idx ON public.endorsements USING btree (venture_id); -- valid: true
```

### Policies

#### endorsements.endorsements_read_own

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((endorser_id = ( SELECT auth.uid() AS uid)) OR (endorsee_id = ( SELECT auth.uid() AS uid)))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER endorsements_changed_insert AFTER INSERT ON endorsements REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION private.endorsements_changed(); -- enabled: O
```

```sql
CREATE TRIGGER endorsements_changed_update AFTER UPDATE ON endorsements REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION private.endorsements_changed(); -- enabled: O
```

```sql
CREATE TRIGGER endorsements_recompute_insert AFTER INSERT ON endorsements REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION private.recompute_endorsees(); -- enabled: O
```

```sql
CREATE TRIGGER endorsements_recompute_update AFTER UPDATE ON endorsements REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION private.recompute_endorsees(); -- enabled: O
```

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON endorsements FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```
