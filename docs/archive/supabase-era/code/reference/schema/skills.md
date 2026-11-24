Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# skills

## private.sync_skills(p_version integer, p_skills jsonb)

[src: supabase/migrations/20260927225000_skills.sql#sync_skills]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sync_skills(p_version integer, p_skills jsonb) | plpgsql | true | search_path="" | None | 20260927225000_skills.sql |

## public.skills

[src: supabase/migrations/20260927225000_skills.sql#skills]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | text | true | — |  |  | "default" |
| name | text | true | — |  |  | "default" |
| category | skill_category | true | — |  |  | — |
| parent_id | text | false | — |  |  | "default" |
| detectors | jsonb | true | '{}'::jsonb |  |  | — |
| taxonomy_version | integer | true | — |  |  | — |
| retired_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
skills_detectors_check: CHECK (jsonb_typeof(detectors) = 'object'::text); -- validated: true
```

```sql
skills_id_check: CHECK (id ~ '^[a-z0-9][a-z0-9-]{0,39}$'::text); -- validated: true
```

```sql
skills_name_check: CHECK (char_length(name) >= 1 AND char_length(name) <= 60); -- validated: true
```

```sql
skills_parent_id_fkey: FOREIGN KEY (parent_id) REFERENCES skills(id) ON DELETE SET NULL; -- validated: true
```

```sql
skills_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
skills_taxonomy_version_check: CHECK (taxonomy_version >= 1); -- validated: true
```

### Indexes

```sql
CREATE INDEX skills_parent_idx ON public.skills USING btree (parent_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX skills_pkey ON public.skills USING btree (id); -- valid: true
```

### Policies

#### skills.skills_read_signed_in

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "true",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER skills_updated_at BEFORE UPDATE ON skills FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```
