Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# platform-net

## enum: net.request_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "PENDING",
    "SUCCESS",
    "ERROR"
  ]
}
```

## net._await_response(request_id bigint)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| net._await_response(request_id bigint) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## net._encode_url_with_params_array(url text, params_array text[])

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| net._encode_url_with_params_array(url text, params_array text[]) | c | false | (session default) | PUBLIC | (platform/extension) |

## net._http_collect_response(request_id bigint, async boolean)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| net._http_collect_response(request_id bigint, async boolean) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## net._urlencode_string(string character varying)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| net._urlencode_string(string character varying) | c | false | (session default) | PUBLIC | (platform/extension) |

## net.check_worker_is_up()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| net.check_worker_is_up() | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## net.http_collect_response(request_id bigint, async boolean)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| net.http_collect_response(request_id bigint, async boolean) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## net.http_delete(url text, params jsonb, headers jsonb, timeout_milliseconds integer, body jsonb)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| net.http_delete(url text, params jsonb, headers jsonb, timeout_milliseconds integer, body jsonb) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) | plpgsql | true | search_path=net | anon, authenticated, postgres, service_role, supabase_functions_admin | (platform/extension) |

## net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) | plpgsql | true | search_path=net | anon, authenticated, postgres, service_role, supabase_functions_admin | (platform/extension) |

## net.wait_until_running()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| net.wait_until_running() | c | false | (session default) | PUBLIC | (platform/extension) |

## net.wake()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| net.wake() | c | false | (session default) | PUBLIC | (platform/extension) |

## net.worker_restart()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| net.worker_restart() | c | false | (session default) | PUBLIC | (platform/extension) |

## net._http_response

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | false | — |  |  | — |
| status_code | integer | false | — |  |  | — |
| content_type | text | false | — |  |  | "default" |
| headers | jsonb | false | — |  |  | — |
| content | text | false | — |  |  | "default" |
| timed_out | boolean | false | — |  |  | — |
| error_msg | text | false | — |  |  | "default" |
| created | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

None.

### Indexes

```sql
CREATE INDEX _http_response_created_idx ON net._http_response USING btree (created); -- valid: true
```

### Policies

None.

### Triggers

None.

## net.http_request_queue

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | nextval('net.http_request_queue_id_seq'::regclass) |  |  | — |
| method | net.http_method | true | — |  |  | "default" |
| url | text | true | — |  |  | "default" |
| headers | jsonb | false | — |  |  | — |
| body | bytea | false | — |  |  | — |
| timeout_milliseconds | integer | true | — |  |  | — |

### Keys and constraints

None.

### Indexes

None.

### Policies

None.

### Triggers

None.
