Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# ai_assisted_commits

## private.agent_commit_shas(p_user uuid, p_repo bigint)

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#agent_commit_shas]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.agent_commit_shas(p_user uuid, p_repo bigint) | sql | true | search_path="" | None | 20261103000000_ai_assisted_commits.sql |

## private.agent_prs_checked(p_user uuid, p_repo bigint, p_mark boolean)

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#agent_prs_checked]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.agent_prs_checked(p_user uuid, p_repo bigint, p_mark boolean) | plpgsql | true | search_path="" | None | 20261103000000_ai_assisted_commits.sql |

## private.ai_agent_label(p_agent text)

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#ai_agent_label]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ai_agent_label(p_agent text) | sql | true | search_path="" | authenticated, service_role | 20261103000000_ai_assisted_commits.sql |

## private.ai_agents()

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#ai_agents]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ai_agents() | sql | true | search_path="" | None | 20261103000000_ai_assisted_commits.sql |

## private.cv_snapshot_base(p_user uuid)

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#cv_snapshot_base]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_snapshot_base(p_user uuid) | plpgsql | true | search_path="" | None | 20261103000000_ai_assisted_commits.sql |

## private.harvest_commits(p_user uuid, p_repo bigint, p_commits jsonb, p_complete boolean)

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#harvest_commits]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.harvest_commits(p_user uuid, p_repo bigint, p_commits jsonb, p_complete boolean) | plpgsql | true | search_path="" | None | 20261103000000_ai_assisted_commits.sql |

## private.my_skill_proofs(p_skill text)

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#my_skill_proofs]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_skill_proofs(p_skill text) | sql | true | search_path="" | authenticated | 20261103000000_ai_assisted_commits.sql |

## private.my_skills()

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#my_skills]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_skills() | sql | true | search_path="" | authenticated | 20261103000000_ai_assisted_commits.sql |

## private.recompute_user_skills(p_user uuid)

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#recompute_user_skills]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.recompute_user_skills(p_user uuid) | plpgsql | true | search_path="" | None | 20261103000000_ai_assisted_commits.sql |

## private.record_commit(p_user uuid, p_repo bigint, p_commit jsonb)

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#record_commit]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.record_commit(p_user uuid, p_repo bigint, p_commit jsonb) | plpgsql | true | search_path="" | None | 20261103000000_ai_assisted_commits.sql |

## private.search_talent(p_filters jsonb, p_offset integer)

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#search_talent]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.search_talent(p_filters jsonb, p_offset integer) | plpgsql | true | search_path="" | authenticated | 20261103000000_ai_assisted_commits.sql |

## private.shared_repo_id(p_user uuid, p_github_repo_id bigint)

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#shared_repo_id]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.shared_repo_id(p_user uuid, p_github_repo_id bigint) | sql | true | search_path="" | None | 20261103000000_ai_assisted_commits.sql |

## private.sync_venture_commits(p_venture uuid, p_user uuid)

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#sync_venture_commits]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sync_venture_commits(p_venture uuid, p_user uuid) | plpgsql | true | search_path="" | None | 20261103000000_ai_assisted_commits.sql |

## private.talent_explore(p_filters jsonb, p_offset integer)

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#talent_explore]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.talent_explore(p_filters jsonb, p_offset integer) | plpgsql | true | search_path="" | authenticated | 20261103000000_ai_assisted_commits.sql |

## public.my_skills()

[src: supabase/migrations/20261103000000_ai_assisted_commits.sql#my_skills]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_skills() | sql | false | search_path="" | authenticated, service_role | 20261103000000_ai_assisted_commits.sql |
