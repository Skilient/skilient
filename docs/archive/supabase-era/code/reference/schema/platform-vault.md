Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# platform-vault

## extension: vault.supabase_vault

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "version": "0.3.1"
}
```

## vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) | c | false | (session default) | postgres, service_role | (platform/extension) |

## vault._crypto_aead_det_encrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| vault._crypto_aead_det_encrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) | c | false | (session default) | None | (platform/extension) |

## vault._crypto_aead_det_noncegen()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| vault._crypto_aead_det_noncegen() | c | false | (session default) | None | (platform/extension) |

## vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) | plpgsql | true | search_path="" | postgres, service_role | (platform/extension) |

## vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) | plpgsql | true | search_path="" | postgres, service_role | (platform/extension) |

## vault.secrets

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| name | text | false | — |  |  | "default" |
| description | text | true | ''::text |  |  | "default" |
| secret | text | true | — |  |  | "default" |
| key_id | uuid | false | — |  |  | — |
| nonce | bytea | false | vault._crypto_aead_det_noncegen() |  |  | — |
| created_at | timestamp with time zone | true | CURRENT_TIMESTAMP |  |  | — |
| updated_at | timestamp with time zone | true | CURRENT_TIMESTAMP |  |  | — |

### Keys and constraints

```sql
secrets_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX secrets_name_idx ON vault.secrets USING btree (name) WHERE (name IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX secrets_pkey ON vault.secrets USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## view: vault.decrypted_secrets

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "options": null,
  "definition": " SELECT id,\n    name,\n    description,\n    secret,\n    convert_from(vault._crypto_aead_det_decrypt(message => decode(secret, 'base64'::text), additional => convert_to(id::text, 'utf8'::name), key_id => 0::bigint, context => '\\x7067736f6469756d'::bytea, nonce => nonce), 'utf8'::name) AS decrypted_secret,\n    key_id,\n    nonce,\n    created_at,\n    updated_at\n   FROM vault.secrets s;"
}
```
