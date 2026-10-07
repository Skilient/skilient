Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# platform-auth

## enum: auth.aal_level

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "aal1",
    "aal2",
    "aal3"
  ]
}
```

## enum: auth.code_challenge_method

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "s256",
    "plain"
  ]
}
```

## enum: auth.factor_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "unverified",
    "verified"
  ]
}
```

## enum: auth.factor_type

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "totp",
    "webauthn",
    "phone",
    "recovery_code"
  ]
}
```

## enum: auth.oauth_authorization_status

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "pending",
    "approved",
    "denied",
    "expired"
  ]
}
```

## enum: auth.oauth_client_type

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "public",
    "confidential"
  ]
}
```

## enum: auth.oauth_registration_type

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "dynamic",
    "manual"
  ]
}
```

## enum: auth.oauth_response_type

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "code"
  ]
}
```

## enum: auth.one_time_token_type

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "confirmation_token",
    "reauthentication_token",
    "recovery_token",
    "email_change_token_new",
    "email_change_token_current",
    "phone_change_token"
  ]
}
```

## auth.email()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| auth.email() | sql | false | (session default) | PUBLIC, dashboard_user | (platform/extension) |

## auth.jwt()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| auth.jwt() | sql | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## auth.role()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| auth.role() | sql | false | (session default) | PUBLIC, dashboard_user | (platform/extension) |

## auth.uid()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| auth.uid() | sql | false | (session default) | PUBLIC, dashboard_user | (platform/extension) |

## auth.audit_log_entries

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| instance_id | uuid | false | — |  |  | — |
| id | uuid | true | — |  |  | — |
| payload | json | false | — |  |  | — |
| created_at | timestamp with time zone | false | — |  |  | — |
| ip_address | character varying(64) | true | ''::character varying |  |  | "default" |

### Keys and constraints

```sql
audit_log_entries_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX audit_log_entries_pkey ON auth.audit_log_entries USING btree (id); -- valid: true
```

```sql
CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.custom_oauth_providers

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| provider_type | text | true | — |  |  | "default" |
| identifier | text | true | — |  |  | "default" |
| name | text | true | — |  |  | "default" |
| client_id | text | true | — |  |  | "default" |
| client_secret | text | true | — |  |  | "default" |
| acceptable_client_ids | text[] | true | '{}'::text[] |  |  | "default" |
| scopes | text[] | true | '{}'::text[] |  |  | "default" |
| pkce_enabled | boolean | true | true |  |  | — |
| attribute_mapping | jsonb | true | '{}'::jsonb |  |  | — |
| authorization_params | jsonb | true | '{}'::jsonb |  |  | — |
| enabled | boolean | true | true |  |  | — |
| email_optional | boolean | true | false |  |  | — |
| issuer | text | false | — |  |  | "default" |
| discovery_url | text | false | — |  |  | "default" |
| skip_nonce_check | boolean | true | false |  |  | — |
| cached_discovery | jsonb | false | — |  |  | — |
| discovery_cached_at | timestamp with time zone | false | — |  |  | — |
| authorization_url | text | false | — |  |  | "default" |
| token_url | text | false | — |  |  | "default" |
| userinfo_url | text | false | — |  |  | "default" |
| jwks_uri | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| custom_claims_allowlist | text[] | true | '{}'::text[] |  |  | "default" |

### Keys and constraints

```sql
custom_oauth_providers_authorization_url_https: CHECK (authorization_url IS NULL OR authorization_url ~~ 'https://%'::text); -- validated: true
```

```sql
custom_oauth_providers_authorization_url_length: CHECK (authorization_url IS NULL OR char_length(authorization_url) <= 2048); -- validated: true
```

```sql
custom_oauth_providers_client_id_length: CHECK (char_length(client_id) >= 1 AND char_length(client_id) <= 512); -- validated: true
```

```sql
custom_oauth_providers_discovery_url_length: CHECK (discovery_url IS NULL OR char_length(discovery_url) <= 2048); -- validated: true
```

```sql
custom_oauth_providers_identifier_format: CHECK (identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text); -- validated: true
```

```sql
custom_oauth_providers_identifier_key: UNIQUE (identifier); -- validated: true
```

```sql
custom_oauth_providers_issuer_length: CHECK (issuer IS NULL OR char_length(issuer) >= 1 AND char_length(issuer) <= 2048); -- validated: true
```

```sql
custom_oauth_providers_jwks_uri_https: CHECK (jwks_uri IS NULL OR jwks_uri ~~ 'https://%'::text); -- validated: true
```

```sql
custom_oauth_providers_jwks_uri_length: CHECK (jwks_uri IS NULL OR char_length(jwks_uri) <= 2048); -- validated: true
```

```sql
custom_oauth_providers_name_length: CHECK (char_length(name) >= 1 AND char_length(name) <= 100); -- validated: true
```

```sql
custom_oauth_providers_oauth2_requires_endpoints: CHECK (provider_type <> 'oauth2'::text OR authorization_url IS NOT NULL AND token_url IS NOT NULL AND userinfo_url IS NOT NULL); -- validated: true
```

```sql
custom_oauth_providers_oidc_discovery_url_https: CHECK (provider_type <> 'oidc'::text OR discovery_url IS NULL OR discovery_url ~~ 'https://%'::text); -- validated: true
```

```sql
custom_oauth_providers_oidc_issuer_https: CHECK (provider_type <> 'oidc'::text OR issuer IS NULL OR issuer ~~ 'https://%'::text); -- validated: true
```

```sql
custom_oauth_providers_oidc_requires_issuer: CHECK (provider_type <> 'oidc'::text OR issuer IS NOT NULL); -- validated: true
```

```sql
custom_oauth_providers_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
custom_oauth_providers_provider_type_check: CHECK (provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text])); -- validated: true
```

```sql
custom_oauth_providers_token_url_https: CHECK (token_url IS NULL OR token_url ~~ 'https://%'::text); -- validated: true
```

```sql
custom_oauth_providers_token_url_length: CHECK (token_url IS NULL OR char_length(token_url) <= 2048); -- validated: true
```

```sql
custom_oauth_providers_userinfo_url_https: CHECK (userinfo_url IS NULL OR userinfo_url ~~ 'https://%'::text); -- validated: true
```

```sql
custom_oauth_providers_userinfo_url_length: CHECK (userinfo_url IS NULL OR char_length(userinfo_url) <= 2048); -- validated: true
```

### Indexes

```sql
CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at); -- valid: true
```

```sql
CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled); -- valid: true
```

```sql
CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier); -- valid: true
```

```sql
CREATE UNIQUE INDEX custom_oauth_providers_identifier_key ON auth.custom_oauth_providers USING btree (identifier); -- valid: true
```

```sql
CREATE UNIQUE INDEX custom_oauth_providers_pkey ON auth.custom_oauth_providers USING btree (id); -- valid: true
```

```sql
CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.flow_state

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| user_id | uuid | false | — |  |  | — |
| auth_code | text | false | — |  |  | "default" |
| code_challenge_method | auth.code_challenge_method | false | — |  |  | — |
| code_challenge | text | false | — |  |  | "default" |
| provider_type | text | true | — |  |  | "default" |
| provider_access_token | text | false | — |  |  | "default" |
| provider_refresh_token | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | false | — |  |  | — |
| updated_at | timestamp with time zone | false | — |  |  | — |
| authentication_method | text | true | — |  |  | "default" |
| auth_code_issued_at | timestamp with time zone | false | — |  |  | — |
| invite_token | text | false | — |  |  | "default" |
| referrer | text | false | — |  |  | "default" |
| oauth_client_state_id | uuid | false | — |  |  | — |
| linking_target_id | uuid | false | — |  |  | — |
| email_optional | boolean | true | false |  |  | — |

### Keys and constraints

```sql
flow_state_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX flow_state_pkey ON auth.flow_state USING btree (id); -- valid: true
```

```sql
CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code); -- valid: true
```

```sql
CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.identities

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| provider_id | text | true | — |  |  | "default" |
| user_id | uuid | true | — |  |  | — |
| identity_data | jsonb | true | — |  |  | — |
| provider | text | true | — |  |  | "default" |
| last_sign_in_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | false | — |  |  | — |
| updated_at | timestamp with time zone | false | — |  |  | — |
| email | text | false | lower((identity_data ->> 'email'::text)) |  | s | "default" |
| id | uuid | true | gen_random_uuid() |  |  | — |

### Keys and constraints

```sql
identities_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
identities_provider_id_provider_unique: UNIQUE (provider_id, provider); -- validated: true
```

```sql
identities_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops); -- valid: true
```

```sql
CREATE UNIQUE INDEX identities_pkey ON auth.identities USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX identities_provider_id_provider_unique ON auth.identities USING btree (provider_id, provider); -- valid: true
```

```sql
CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.instances

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| uuid | uuid | false | — |  |  | — |
| raw_base_config | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | false | — |  |  | — |
| updated_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
instances_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX instances_pkey ON auth.instances USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.mfa_amr_claims

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| session_id | uuid | true | — |  |  | — |
| created_at | timestamp with time zone | true | — |  |  | — |
| updated_at | timestamp with time zone | true | — |  |  | — |
| authentication_method | text | true | — |  |  | "default" |
| id | uuid | true | — |  |  | — |

### Keys and constraints

```sql
amr_id_pk: PRIMARY KEY (id); -- validated: true
```

```sql
mfa_amr_claims_session_id_authentication_method_pkey: UNIQUE (session_id, authentication_method); -- validated: true
```

```sql
mfa_amr_claims_session_id_fkey: FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX amr_id_pk ON auth.mfa_amr_claims USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX mfa_amr_claims_session_id_authentication_method_pkey ON auth.mfa_amr_claims USING btree (session_id, authentication_method); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.mfa_challenges

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| factor_id | uuid | true | — |  |  | — |
| created_at | timestamp with time zone | true | — |  |  | — |
| verified_at | timestamp with time zone | false | — |  |  | — |
| ip_address | inet | true | — |  |  | — |
| otp_code | text | false | — |  |  | "default" |
| web_authn_session_data | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
mfa_challenges_auth_factor_id_fkey: FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE; -- validated: true
```

```sql
mfa_challenges_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX mfa_challenges_pkey ON auth.mfa_challenges USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.mfa_factors

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| friendly_name | text | false | — |  |  | "default" |
| factor_type | auth.factor_type | true | — |  |  | — |
| status | auth.factor_status | true | — |  |  | — |
| created_at | timestamp with time zone | true | — |  |  | — |
| updated_at | timestamp with time zone | true | — |  |  | — |
| secret | text | false | — |  |  | "default" |
| phone | text | false | — |  |  | "default" |
| last_challenged_at | timestamp with time zone | false | — |  |  | — |
| web_authn_credential | jsonb | false | — |  |  | — |
| web_authn_aaguid | uuid | false | — |  |  | — |
| last_webauthn_challenge_data | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
mfa_factors_last_challenged_at_key: UNIQUE (last_challenged_at); -- validated: true
```

```sql
mfa_factors_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
mfa_factors_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX mfa_factors_last_challenged_at_key ON auth.mfa_factors USING btree (last_challenged_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX mfa_factors_pkey ON auth.mfa_factors USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text); -- valid: true
```

```sql
CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.mfa_recovery_code_sets

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| mfa_factor_id | uuid | true | — |  |  | — |
| failed_verification_count | integer | true | 0 |  |  | — |
| verification_locked_until | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
mfa_recovery_code_sets_failed_verification_count_check: CHECK (failed_verification_count >= 0); -- validated: true
```

```sql
mfa_recovery_code_sets_mfa_factor_id_fkey: FOREIGN KEY (mfa_factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE; -- validated: true
```

```sql
mfa_recovery_code_sets_mfa_factor_id_key: UNIQUE (mfa_factor_id); -- validated: true
```

```sql
mfa_recovery_code_sets_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
mfa_recovery_code_sets_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
mfa_recovery_code_sets_user_id_key: UNIQUE (user_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX mfa_recovery_code_sets_mfa_factor_id_key ON auth.mfa_recovery_code_sets USING btree (mfa_factor_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX mfa_recovery_code_sets_pkey ON auth.mfa_recovery_code_sets USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX mfa_recovery_code_sets_user_id_key ON auth.mfa_recovery_code_sets USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.mfa_recovery_codes

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| mfa_recovery_code_set_id | uuid | true | — |  |  | — |
| code_hash | text | true | — |  |  | "default" |
| consumed_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
mfa_recovery_codes_mfa_recovery_code_set_id_fkey: FOREIGN KEY (mfa_recovery_code_set_id) REFERENCES auth.mfa_recovery_code_sets(id) ON DELETE CASCADE; -- validated: true
```

```sql
mfa_recovery_codes_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX mfa_recovery_codes_pkey ON auth.mfa_recovery_codes USING btree (id); -- valid: true
```

```sql
CREATE INDEX mfa_recovery_codes_set_id_idx ON auth.mfa_recovery_codes USING btree (mfa_recovery_code_set_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.oauth_authorizations

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| authorization_id | text | true | — |  |  | "default" |
| client_id | uuid | true | — |  |  | — |
| user_id | uuid | false | — |  |  | — |
| redirect_uri | text | true | — |  |  | "default" |
| scope | text | true | — |  |  | "default" |
| state | text | false | — |  |  | "default" |
| resource | text | false | — |  |  | "default" |
| code_challenge | text | false | — |  |  | "default" |
| code_challenge_method | auth.code_challenge_method | false | — |  |  | — |
| response_type | auth.oauth_response_type | true | 'code'::auth.oauth_response_type |  |  | — |
| status | auth.oauth_authorization_status | true | 'pending'::auth.oauth_authorization_status |  |  | — |
| authorization_code | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| expires_at | timestamp with time zone | true | (now() + '00:03:00'::interval) |  |  | — |
| approved_at | timestamp with time zone | false | — |  |  | — |
| nonce | text | false | — |  |  | "default" |

### Keys and constraints

```sql
oauth_authorizations_authorization_code_key: UNIQUE (authorization_code); -- validated: true
```

```sql
oauth_authorizations_authorization_code_length: CHECK (char_length(authorization_code) <= 255); -- validated: true
```

```sql
oauth_authorizations_authorization_id_key: UNIQUE (authorization_id); -- validated: true
```

```sql
oauth_authorizations_client_id_fkey: FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE; -- validated: true
```

```sql
oauth_authorizations_code_challenge_length: CHECK (char_length(code_challenge) <= 128); -- validated: true
```

```sql
oauth_authorizations_expires_at_future: CHECK (expires_at > created_at); -- validated: true
```

```sql
oauth_authorizations_nonce_length: CHECK (char_length(nonce) <= 255); -- validated: true
```

```sql
oauth_authorizations_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
oauth_authorizations_redirect_uri_length: CHECK (char_length(redirect_uri) <= 2048); -- validated: true
```

```sql
oauth_authorizations_resource_length: CHECK (char_length(resource) <= 2048); -- validated: true
```

```sql
oauth_authorizations_scope_length: CHECK (char_length(scope) <= 4096); -- validated: true
```

```sql
oauth_authorizations_state_length: CHECK (char_length(state) <= 4096); -- validated: true
```

```sql
oauth_authorizations_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status); -- valid: true
```

```sql
CREATE UNIQUE INDEX oauth_authorizations_authorization_code_key ON auth.oauth_authorizations USING btree (authorization_code); -- valid: true
```

```sql
CREATE UNIQUE INDEX oauth_authorizations_authorization_id_key ON auth.oauth_authorizations USING btree (authorization_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX oauth_authorizations_pkey ON auth.oauth_authorizations USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.oauth_client_states

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| provider_type | text | true | — |  |  | "default" |
| code_verifier | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | — |  |  | — |

### Keys and constraints

```sql
oauth_client_states_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX oauth_client_states_pkey ON auth.oauth_client_states USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.oauth_clients

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| client_secret_hash | text | false | — |  |  | "default" |
| registration_type | auth.oauth_registration_type | true | — |  |  | — |
| redirect_uris | text | true | — |  |  | "default" |
| grant_types | text | true | — |  |  | "default" |
| client_name | text | false | — |  |  | "default" |
| client_uri | text | false | — |  |  | "default" |
| logo_uri | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| deleted_at | timestamp with time zone | false | — |  |  | — |
| client_type | auth.oauth_client_type | true | 'confidential'::auth.oauth_client_type |  |  | — |
| token_endpoint_auth_method | text | true | — |  |  | "default" |

### Keys and constraints

```sql
oauth_clients_client_name_length: CHECK (char_length(client_name) <= 1024); -- validated: true
```

```sql
oauth_clients_client_uri_length: CHECK (char_length(client_uri) <= 2048); -- validated: true
```

```sql
oauth_clients_logo_uri_length: CHECK (char_length(logo_uri) <= 2048); -- validated: true
```

```sql
oauth_clients_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
oauth_clients_token_endpoint_auth_method_check: CHECK (token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])); -- validated: true
```

### Indexes

```sql
CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX oauth_clients_pkey ON auth.oauth_clients USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.oauth_consents

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| client_id | uuid | true | — |  |  | — |
| scopes | text | true | — |  |  | "default" |
| granted_at | timestamp with time zone | true | now() |  |  | — |
| revoked_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
oauth_consents_client_id_fkey: FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE; -- validated: true
```

```sql
oauth_consents_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
oauth_consents_revoked_after_granted: CHECK (revoked_at IS NULL OR revoked_at >= granted_at); -- validated: true
```

```sql
oauth_consents_scopes_length: CHECK (char_length(scopes) <= 2048); -- validated: true
```

```sql
oauth_consents_scopes_not_empty: CHECK (char_length(TRIM(BOTH FROM scopes)) > 0); -- validated: true
```

```sql
oauth_consents_user_client_unique: UNIQUE (user_id, client_id); -- validated: true
```

```sql
oauth_consents_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL); -- valid: true
```

```sql
CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX oauth_consents_pkey ON auth.oauth_consents USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX oauth_consents_user_client_unique ON auth.oauth_consents USING btree (user_id, client_id); -- valid: true
```

```sql
CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.one_time_tokens

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| token_type | auth.one_time_token_type | true | — |  |  | — |
| token_hash | text | true | — |  |  | "default" |
| relates_to | text | true | — |  |  | "default" |
| created_at | timestamp without time zone | true | now() |  |  | — |
| updated_at | timestamp without time zone | true | now() |  |  | — |
| expires_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
one_time_tokens_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
one_time_tokens_token_hash_check: CHECK (char_length(token_hash) > 0); -- validated: true
```

```sql
one_time_tokens_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX one_time_tokens_pkey ON auth.one_time_tokens USING btree (id); -- valid: true
```

```sql
CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to); -- valid: true
```

```sql
CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash); -- valid: true
```

```sql
CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.refresh_tokens

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| instance_id | uuid | false | — |  |  | — |
| id | bigint | true | nextval('auth.refresh_tokens_id_seq'::regclass) |  |  | — |
| token | character varying(255) | false | — |  |  | "default" |
| user_id | character varying(255) | false | — |  |  | "default" |
| revoked | boolean | false | — |  |  | — |
| created_at | timestamp with time zone | false | — |  |  | — |
| updated_at | timestamp with time zone | false | — |  |  | — |
| parent | character varying(255) | false | — |  |  | "default" |
| session_id | uuid | false | — |  |  | — |

### Keys and constraints

```sql
refresh_tokens_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
refresh_tokens_session_id_fkey: FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE; -- validated: true
```

```sql
refresh_tokens_token_unique: UNIQUE (token); -- validated: true
```

### Indexes

```sql
CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id); -- valid: true
```

```sql
CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id); -- valid: true
```

```sql
CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent); -- valid: true
```

```sql
CREATE UNIQUE INDEX refresh_tokens_pkey ON auth.refresh_tokens USING btree (id); -- valid: true
```

```sql
CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked); -- valid: true
```

```sql
CREATE UNIQUE INDEX refresh_tokens_token_unique ON auth.refresh_tokens USING btree (token); -- valid: true
```

```sql
CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.saml_providers

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| sso_provider_id | uuid | true | — |  |  | — |
| entity_id | text | true | — |  |  | "default" |
| metadata_xml | text | true | — |  |  | "default" |
| metadata_url | text | false | — |  |  | "default" |
| attribute_mapping | jsonb | false | — |  |  | — |
| created_at | timestamp with time zone | false | — |  |  | — |
| updated_at | timestamp with time zone | false | — |  |  | — |
| name_id_format | text | false | — |  |  | "default" |

### Keys and constraints

```sql
entity_id not empty: CHECK (char_length(entity_id) > 0); -- validated: true
```

```sql
metadata_url not empty: CHECK (metadata_url = NULL::text OR char_length(metadata_url) > 0); -- validated: true
```

```sql
metadata_xml not empty: CHECK (char_length(metadata_xml) > 0); -- validated: true
```

```sql
saml_providers_entity_id_key: UNIQUE (entity_id); -- validated: true
```

```sql
saml_providers_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
saml_providers_sso_provider_id_fkey: FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX saml_providers_entity_id_key ON auth.saml_providers USING btree (entity_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX saml_providers_pkey ON auth.saml_providers USING btree (id); -- valid: true
```

```sql
CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.saml_relay_states

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| sso_provider_id | uuid | true | — |  |  | — |
| request_id | text | true | — |  |  | "default" |
| for_email | text | false | — |  |  | "default" |
| redirect_to | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | false | — |  |  | — |
| updated_at | timestamp with time zone | false | — |  |  | — |
| flow_state_id | uuid | false | — |  |  | — |

### Keys and constraints

```sql
request_id not empty: CHECK (char_length(request_id) > 0); -- validated: true
```

```sql
saml_relay_states_flow_state_id_fkey: FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE; -- validated: true
```

```sql
saml_relay_states_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
saml_relay_states_sso_provider_id_fkey: FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC); -- valid: true
```

```sql
CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email); -- valid: true
```

```sql
CREATE UNIQUE INDEX saml_relay_states_pkey ON auth.saml_relay_states USING btree (id); -- valid: true
```

```sql
CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.schema_migrations

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| version | character varying(255) | true | — |  |  | "default" |

### Keys and constraints

```sql
schema_migrations_pkey: PRIMARY KEY (version); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX schema_migrations_pkey ON auth.schema_migrations USING btree (version); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.scim_tokens

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| sso_provider_id | uuid | true | — |  |  | — |
| token_hash | text | true | — |  |  | "default" |
| prefix | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| expires_at | timestamp with time zone | false | — |  |  | — |
| revoked_at | timestamp with time zone | false | — |  |  | — |
| last_used_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
scim_tokens_expires_at_future: CHECK (expires_at IS NULL OR expires_at > created_at); -- validated: true
```

```sql
scim_tokens_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
scim_tokens_revoked_after_created: CHECK (revoked_at IS NULL OR revoked_at >= created_at); -- validated: true
```

```sql
scim_tokens_sso_provider_id_fkey: FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE; -- validated: true
```

```sql
scim_tokens_token_hash_check: CHECK (token_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

### Indexes

```sql
CREATE INDEX scim_tokens_expires_at_idx ON auth.scim_tokens USING btree (expires_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX scim_tokens_pkey ON auth.scim_tokens USING btree (id); -- valid: true
```

```sql
CREATE INDEX scim_tokens_revoked_at_idx ON auth.scim_tokens USING btree (revoked_at); -- valid: true
```

```sql
CREATE INDEX scim_tokens_sso_provider_id_idx ON auth.scim_tokens USING btree (sso_provider_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX scim_tokens_token_hash_key ON auth.scim_tokens USING btree (token_hash); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.scim_users

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| sso_provider_id | uuid | true | — |  |  | — |
| user_id | uuid | false | — |  |  | — |
| resource | jsonb | true | — |  |  | — |
| user_name | text | true | lower((resource ->> 'userName'::text)) |  | s | "default" |
| external_id | text | false | (resource ->> 'externalId'::text) |  | s | "default" |
| active | boolean | true | COALESCE(((resource ->> 'active'::text))::boolean, true) |  | s | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| deleted_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
scim_users_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
scim_users_sso_provider_id_fkey: FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE; -- validated: true
```

```sql
scim_users_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE INDEX scim_users_created_at_idx ON auth.scim_users USING btree (sso_provider_id, created_at, id) WHERE (deleted_at IS NULL); -- valid: true
```

```sql
CREATE INDEX scim_users_deleted_at_idx ON auth.scim_users USING btree (deleted_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX scim_users_external_id_key ON auth.scim_users USING btree (sso_provider_id, external_id) WHERE ((external_id IS NOT NULL) AND (deleted_at IS NULL)); -- valid: true
```

```sql
CREATE INDEX scim_users_id_idx ON auth.scim_users USING btree (sso_provider_id, id) WHERE (deleted_at IS NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX scim_users_pkey ON auth.scim_users USING btree (id); -- valid: true
```

```sql
CREATE INDEX scim_users_sso_provider_id_idx ON auth.scim_users USING btree (sso_provider_id); -- valid: true
```

```sql
CREATE INDEX scim_users_updated_at_idx ON auth.scim_users USING btree (sso_provider_id, updated_at, id) WHERE (deleted_at IS NULL); -- valid: true
```

```sql
CREATE INDEX scim_users_user_id_idx ON auth.scim_users USING btree (user_id); -- valid: true
```

```sql
CREATE INDEX scim_users_user_name_idx ON auth.scim_users USING btree (sso_provider_id, user_name COLLATE "C", id) WHERE (deleted_at IS NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX scim_users_user_name_key ON auth.scim_users USING btree (sso_provider_id, user_name) WHERE (deleted_at IS NULL); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.sessions

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| created_at | timestamp with time zone | false | — |  |  | — |
| updated_at | timestamp with time zone | false | — |  |  | — |
| factor_id | uuid | false | — |  |  | — |
| aal | auth.aal_level | false | — |  |  | — |
| not_after | timestamp with time zone | false | — |  |  | — |
| refreshed_at | timestamp without time zone | false | — |  |  | — |
| user_agent | text | false | — |  |  | "default" |
| ip | inet | false | — |  |  | — |
| tag | text | false | — |  |  | "default" |
| oauth_client_id | uuid | false | — |  |  | — |
| refresh_token_hmac_key | text | false | — |  |  | "default" |
| refresh_token_counter | bigint | false | — |  |  | — |
| scopes | text | false | — |  |  | "default" |

### Keys and constraints

```sql
sessions_oauth_client_id_fkey: FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE; -- validated: true
```

```sql
sessions_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
sessions_scopes_length: CHECK (char_length(scopes) <= 4096); -- validated: true
```

```sql
sessions_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC); -- valid: true
```

```sql
CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX sessions_pkey ON auth.sessions USING btree (id); -- valid: true
```

```sql
CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id); -- valid: true
```

```sql
CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.sso_domains

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| sso_provider_id | uuid | true | — |  |  | — |
| domain | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | false | — |  |  | — |
| updated_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
domain not empty: CHECK (char_length(domain) > 0); -- validated: true
```

```sql
sso_domains_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
sso_domains_sso_provider_id_fkey: FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain)); -- valid: true
```

```sql
CREATE UNIQUE INDEX sso_domains_pkey ON auth.sso_domains USING btree (id); -- valid: true
```

```sql
CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.sso_providers

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| resource_id | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | false | — |  |  | — |
| updated_at | timestamp with time zone | false | — |  |  | — |
| disabled | boolean | false | — |  |  | — |

### Keys and constraints

```sql
resource_id not empty: CHECK (resource_id = NULL::text OR char_length(resource_id) > 0); -- validated: true
```

```sql
sso_providers_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX sso_providers_pkey ON auth.sso_providers USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id)); -- valid: true
```

```sql
CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.users

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| instance_id | uuid | false | — |  |  | — |
| id | uuid | true | — |  |  | — |
| aud | character varying(255) | false | — |  |  | "default" |
| role | character varying(255) | false | — |  |  | "default" |
| email | character varying(255) | false | — |  |  | "default" |
| encrypted_password | character varying(255) | false | — |  |  | "default" |
| email_confirmed_at | timestamp with time zone | false | — |  |  | — |
| invited_at | timestamp with time zone | false | — |  |  | — |
| confirmation_token | character varying(255) | false | — |  |  | "default" |
| confirmation_sent_at | timestamp with time zone | false | — |  |  | — |
| recovery_token | character varying(255) | false | — |  |  | "default" |
| recovery_sent_at | timestamp with time zone | false | — |  |  | — |
| email_change_token_new | character varying(255) | false | — |  |  | "default" |
| email_change | character varying(255) | false | — |  |  | "default" |
| email_change_sent_at | timestamp with time zone | false | — |  |  | — |
| last_sign_in_at | timestamp with time zone | false | — |  |  | — |
| raw_app_meta_data | jsonb | false | — |  |  | — |
| raw_user_meta_data | jsonb | false | — |  |  | — |
| is_super_admin | boolean | false | — |  |  | — |
| created_at | timestamp with time zone | false | — |  |  | — |
| updated_at | timestamp with time zone | false | — |  |  | — |
| phone | text | false | NULL::character varying |  |  | "default" |
| phone_confirmed_at | timestamp with time zone | false | — |  |  | — |
| phone_change | text | false | ''::character varying |  |  | "default" |
| phone_change_token | character varying(255) | false | ''::character varying |  |  | "default" |
| phone_change_sent_at | timestamp with time zone | false | — |  |  | — |
| confirmed_at | timestamp with time zone | false | LEAST(email_confirmed_at, phone_confirmed_at) |  | s | — |
| email_change_token_current | character varying(255) | false | ''::character varying |  |  | "default" |
| email_change_confirm_status | smallint | false | 0 |  |  | — |
| banned_until | timestamp with time zone | false | — |  |  | — |
| reauthentication_token | character varying(255) | false | ''::character varying |  |  | "default" |
| reauthentication_sent_at | timestamp with time zone | false | — |  |  | — |
| is_sso_user | boolean | true | false |  |  | — |
| deleted_at | timestamp with time zone | false | — |  |  | — |
| is_anonymous | boolean | true | false |  |  | — |

### Keys and constraints

```sql
users_email_change_confirm_status_check: CHECK (email_change_confirm_status >= 0 AND email_change_confirm_status <= 2); -- validated: true
```

```sql
users_phone_key: UNIQUE (phone); -- validated: true
```

```sql
users_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text); -- valid: true
```

```sql
CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text); -- valid: true
```

```sql
CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text); -- valid: true
```

```sql
CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text); -- valid: true
```

```sql
CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text); -- valid: true
```

```sql
CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false); -- valid: true
```

```sql
CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text)); -- valid: true
```

```sql
CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id); -- valid: true
```

```sql
CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous); -- valid: true
```

```sql
CREATE UNIQUE INDEX users_phone_key ON auth.users USING btree (phone); -- valid: true
```

```sql
CREATE UNIQUE INDEX users_pkey ON auth.users USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER analytics_email_verified_insert AFTER INSERT ON auth.users FOR EACH ROW WHEN (new.email_confirmed_at IS NOT NULL) EXECUTE FUNCTION private.analytics_email_verified(); -- enabled: O
```

```sql
CREATE TRIGGER analytics_email_verified_update AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW WHEN (old.email_confirmed_at IS NULL AND new.email_confirmed_at IS NOT NULL) EXECUTE FUNCTION private.analytics_email_verified(); -- enabled: O
```

```sql
CREATE TRIGGER analytics_forget_user AFTER DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION private.analytics_forget_user(); -- enabled: O
```

```sql
CREATE TRIGGER billing_forget_user AFTER DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION private.billing_forget_subject(); -- enabled: O
```

```sql
CREATE TRIGGER cv_on_ban AFTER UPDATE OF banned_until ON auth.users FOR EACH ROW EXECUTE FUNCTION private.cv_on_ban(); -- enabled: O
```

```sql
CREATE TRIGGER cv_on_delete BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION private.cv_on_delete(); -- enabled: O
```

```sql
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user(); -- enabled: O
```

```sql
CREATE TRIGGER on_auth_user_email_change BEFORE UPDATE OF email, email_change ON auth.users FOR EACH ROW EXECUTE FUNCTION private.guard_email_change(); -- enabled: O
```

```sql
CREATE TRIGGER recruit_on_user_delete BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION private.recruit_on_user_delete(); -- enabled: O
```

```sql
CREATE TRIGGER users_guard_uni_admin_email BEFORE UPDATE OF email, email_change ON auth.users FOR EACH ROW EXECUTE FUNCTION private.guard_uni_admin_email_change(); -- enabled: O
```

## auth.webauthn_challenges

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| user_id | uuid | false | — |  |  | — |
| challenge_type | text | true | — |  |  | "default" |
| session_data | jsonb | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| expires_at | timestamp with time zone | true | — |  |  | — |

### Keys and constraints

```sql
webauthn_challenges_challenge_type_check: CHECK (challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])); -- validated: true
```

```sql
webauthn_challenges_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
webauthn_challenges_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX webauthn_challenges_pkey ON auth.webauthn_challenges USING btree (id); -- valid: true
```

```sql
CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## auth.webauthn_credentials

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| user_id | uuid | true | — |  |  | — |
| credential_id | bytea | true | — |  |  | — |
| public_key | bytea | true | — |  |  | — |
| attestation_type | text | true | ''::text |  |  | "default" |
| aaguid | uuid | false | — |  |  | — |
| sign_count | bigint | true | 0 |  |  | — |
| transports | jsonb | true | '[]'::jsonb |  |  | — |
| backup_eligible | boolean | true | false |  |  | — |
| backed_up | boolean | true | false |  |  | — |
| friendly_name | text | true | ''::text |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| last_used_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
webauthn_credentials_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
webauthn_credentials_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX webauthn_credentials_pkey ON auth.webauthn_credentials USING btree (id); -- valid: true
```

```sql
CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

None.
