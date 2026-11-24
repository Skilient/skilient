"""Part 5: aggregate the probe results into measured values and a verdict per principle against its pass bar (probes.json "summary")."""
import json, collections, re
P = json.load(open('docs/ux-pilot/heuristics/probes.json'))
pages = [r for r in P['pages'] if not r.get('error')]
real = [r for r in pages if not r.get('notFound')]
by = collections.defaultdict(list)
for r in real: by[r['cfg']].append(r)
S = {}
# ACC: axe serious/critical, sideways scroll, reflow, text spacing.
serious = collections.Counter(); routes_with = set(); impacts = collections.Counter()
for r in real:
    for v in r.get('axe', []):
        impacts[v['impact']] += 1
        if v['impact'] in ('serious', 'critical'): serious[v['id']] += 1; routes_with.add((r['route'], r['cfg']))
sideways = sorted({f"{r['route']}@{r['cfg']}" for r in real if r.get('sideways')})
reflow = sorted({r['route'] for r in real if r.get('reflow320', {}).get('sideways')})
spacing = sorted({r['route'] for r in real if r.get('textSpacing', {}).get('clipped', 0) > 0})
S['ACC'] = {"axe_serious_or_critical": sum(serious.values()), "axe_by_rule": dict(serious.most_common(12)), "axe_impacts": dict(impacts), "page_configs_with_serious": len(routes_with), "page_configs": len(real), "sideways": sideways, "reflow320_fail": reflow, "text_spacing_clipped_routes": spacing}
S['ACC']['verdict'] = 'fail' if serious or sideways else 'partial' if reflow or spacing else 'pass'
# H06: icon-only without name; tooltip coverage.
unnamed = collections.Counter(); untip = collections.Counter(); unnamedCtrl = collections.Counter()
for r in real:
    for u in r.get('unnamedIcons', []): unnamed[re.sub(r'\s+', ' ', u)[:90]] += 1
    for u in r.get('noTooltip', []): untip[u] += 1
    for u in r.get('unnamedCtrls', []): unnamedCtrl[f"{r['route']}:{u}"] += 1
S['H06'] = {"icon_only_unnamed": sum(unnamed.values()), "examples": [k for k, _ in unnamed.most_common(5)], "icon_only_without_tooltip": dict(untip.most_common(10)), "unnamed_controls": len(unnamedCtrl), "unnamed_examples": [k for k, _ in unnamedCtrl.most_common(15)]}
S['H06']['verdict'] = 'pass' if not unnamed and not unnamedCtrl else 'partial' if sum(unnamed.values()) == 0 else 'fail'
# H08: one primary per screen; main visible on a phone.
multi = sorted({(r['route'], r['primaries']) for r in by['390-dark'] if r.get('primaries', 0) > 1}, key=lambda x: -x[1])
nomain = sorted({r['route'] for r in by['390-dark'] if not r.get('mainVisibleOnLoad')})
S['H08'] = {"pages_390": len(by['390-dark']), "pages_with_more_than_one_primary": len(multi), "worst": multi[:12], "h1_below_fold_390": nomain}
S['H08']['verdict'] = 'pass' if not multi and not nomain else 'partial' if len(multi) < len(by['390-dark']) * 0.2 else 'fail'
# FIT: target size, thumb reach, destructive near primary.
small = sorted(((r['route'], r['smallCount']) for r in by['390-dark'] if r.get('smallCount', 0)), key=lambda x: -x[1])
below = sorted({r['route'] for r in by['390-dark'] if r.get('primaryBelowFold')})
near = sorted({f"{r['route']}: {n['d']} ~ {n['p']} ({n['gap']}px)" for r in real for n in r.get('destructiveNearPrimary', [])})
S['FIT'] = {"pages_with_targets_under_24px": len(small), "worst": small[:10], "examples": sorted({s for r in by['390-dark'] for s in r.get('smallTargets', [])})[:15], "primary_below_fold_390": below, "destructive_within_8px_of_primary": near}
S['FIT']['verdict'] = 'pass' if not near and not small else 'partial' if not near else 'fail'
# HCK: long selects without type-ahead, nav items.
longsel = sorted({f"{r['route']}: {s['name']} ({s['options']})" for r in real for s in r.get('longSelects', [])})
navmax = max((max(r.get('navItems') or [0]) for r in by['1280-dark']), default=0)
S['HCK'] = {"selects_over_15_options": longsel, "all_native_selects": True, "max_nav_links_desktop": navmax, "rail_items": 13, "phone_dock_items": 5}
S['HCK']['verdict'] = 'partial'
# MIL: fields per form.
big = sorted({f"{r['route']}: {f['fields']} fields, {f['fieldsets']} groups" for r in real for f in r.get('forms', []) if f['fields'] > 7})
S['MIL'] = {"forms_over_7_fields": big, "ungrouped": [x for x in big if x.endswith(' 0 groups')]}
S['MIL']['verdict'] = 'pass' if not [x for x in big if x.endswith(' 0 groups')] else 'partial'
# AFF: pointer on non-focusable.
ptr = sorted({f"{r['route']}: {x}" for r in real for x in r.get('pointerNonFocusable', [])})
S['AFF'] = {"pointer_on_non_focusable": ptr[:20], "count": len(ptr)}
S['AFF']['verdict'] = 'pass' if not ptr else 'fail'
# NAV: current place marked (from probe 1) + crawl.
unmarked = sorted({r['route'] for r in by['1280-dark'] if r['role'] != 'visitor' and not r.get('ariaCurrent')})
cr = P.get('crawl', {})
S['NAV'] = {"student_pages_without_current_marked_desktop": unmarked, "crawl_not_within_3": {k: v['notWithin3'] for k, v in cr.items()}, "crawl_orphans": {k: v['orphans'] for k, v in cr.items()}}
S['NAV']['verdict'] = 'fail' if any(v['orphans'] for v in cr.values()) else 'pass'
# H07: Ctrl K.
ck = P.get('ctrlk', {})
S['H07'] = {"in_top3": ck.get('inTop3'), "pages": ck.get('total'), "rate": round(ck.get('rate', 0), 2), "enter_opened_right_page": ck.get('openedRight'), "misses": [x['title'] for x in ck.get('pages', []) if not x['inTop3']][:30]}
S['H07']['verdict'] = 'pass' if ck.get('rate', 0) >= 0.9 else 'fail'
# MOB, DOH, H01 from performance.
pf = P.get('performance', {})
lcp_fail = [f"{p['name']} {p['cold']['lcp']}ms" for p in pf.get('pages', []) if p['cold']['lcp'] > 2500]
cls_fail = [f"{p['name']} {p['cold']['cls']}" for p in pf.get('pages', []) if p['cold']['cls'] > 0.1]
t = pf.get('timings', {})
S['MOB'] = {"lcp_over_2500_cold": lcp_fail, "cls_over_0.1": cls_fail, "lcp_max_cold": max((p['cold']['lcp'] for p in pf.get('pages', [])), default=None), "hydration_note": "Inputs typed before hydration (~6.6 s on /signup) are wiped (R01); LCP doesn't capture it.", "timings": t}
S['MOB']['verdict'] = 'partial' if lcp_fail or t.get('pending_within_100', 1) < 1 else 'pass'
S['DOH'] = {"respond_or_progress_within_400ms": round(t.get('respond_or_progress_400', 0), 2), "bar": 0.95}
S['DOH']['verdict'] = 'pass' if t.get('respond_or_progress_400', 0) >= 0.95 else 'fail'
S['H01'] = {"pending_within_100ms": round(t.get('pending_within_100', 0), 2), "result_within_1s": round(t.get('result_within_1s', 0), 2), "no_pending_sign": t.get('no_pending_sign'), "jobs_without_eta": ["Record 'Signing…'", "Task 'Verifying with GitHub'", "Settings > GitHub 'Not synced yet'", "CV refresh '1 December'"]}
S['H01']['verdict'] = 'fail'
# H03 from destructive.
d = P.get('destructive', {})
S['H03'] = {"controls_judged": d.get('controlsJudged'), "with_confirm_undo_or_way_back": d.get('withConfirmUndoOrWayBack'), "no_way_back": [x['label'] for x in d.get('live', []) if x.get('confirm') == 'none' and not x.get('undo')] + [x['label'] for x in d.get('fromTasks', []) if x['how'] == 'none'], "native_confirm": [x['label'] for x in d.get('fromTasks', []) if x['how'].startswith('native')], "esc": d.get('esc'), "steppers": d.get('steppers')}
S['H03']['verdict'] = 'fail'
# H05/H09 from errors.
e = P.get('errors', {})
S['H09'] = {"probes": len(e.get('probes', [])), "notes": ["Field errors carry aria-invalid + aria-describedby on sign-up and feedback", "Offline composer submit replaces the page with 'Something went wrong on our side' (composer gone)", "/ops tells a student 'This area needs two-factor' instead of not found", "A made-up username showed the daily profile-view limit message"]}
S['H09']['verdict'] = 'partial'
S['H05'] = {"double_click_duplicates": [p for p in e.get('probes', []) if p.get('probe') == 'double-click submit'], "leave_warned": [p for p in e.get('probes', []) if 'leave' in p.get('probe', '')], "limits_shown": "composer 2,000 counter and maxlength; venture title maxlength 80 (silently cut)"}
S['H05']['verdict'] = 'fail'
# EMP.
em = P.get('empty', {})
S['EMP'] = {"empty_states": em.get('emptyStates'), "with_title_explanation_action": em.get('withAllThree'), "action_leads_to_empty": em.get('leadingToEmpty')}
S['EMP']['verdict'] = 'partial'
# PRV / SAF.
v = P.get('viewers', {})
S['PRV'] = {"matrix_cells": len(v.get('matrix', [])), "mismatches": [], "wording_issue": "friends-only profile tells strangers it's shared 'with their university or friends only'", "privacy_controls_clicks_from_home": v.get('privacyControlsClicksFromHome')}
S['PRV']['verdict'] = 'partial'
reach = v.get('reach', [])
S['SAF'] = {"taps": reach, "block_surfaces_leaking": [s for s in v.get('surfaces', []) if s['sees']], "note": "Post report is 2 taps (⋯ then Report, T023)."}
S['SAF']['verdict'] = 'pass' if not S['SAF']['block_surfaces_leaking'] else 'fail'
# TRU.
inv = P.get('invariants', {})
for c in inv.get('checks', []):
    if c['fact'] == 'unread notifications' and c['values'].get('page') == '0':
        c['values']['page'] = '22 marked unread (of 44); no sign of more'; c['consistent'] = False
S['TRU'] = {"checks": len(inv.get('checks', [])), "contradictions": [c['fact'] for c in inv.get('checks', []) if not c['consistent']]}
S['TRU']['verdict'] = 'fail' if S['TRU']['contradictions'] else 'pass'
# COP / H02 / H04 / MOT from copy.
c = P.get('copy', {})
real_typos = [t for t in c.get('typos', []) if t['word'] not in ('ayeshakhan', 'Canva', 'Huzaifa', 'Mursileen', 'Laiba', 'Owais', 'Supabase', 'Vercel', 'Brevo', 'Safepay', 'Softworks', 'misdescribing', 'mwtufpok', 'mwuf', 'waitlist', 'Waitlisted', 'Waitlist')]
S['COP'] = {"strings": c.get('strings'), "typos": real_typos, "long_sentences": len(c.get('long', [])), "long_outside_legal": len([l for l in c.get('long', []) if l.get('where') not in ('/terms', '/privacy', '/agreement')]), "off_flag_mentions": c.get('portalMentions'), "empty_copy_reused": c.get('emptyCopyReused')}
S['COP']['verdict'] = 'fail' if c.get('portalMentions') else 'pass'
S['H02'] = {"terms": c.get('terms')}
S['H02']['verdict'] = 'partial'
S['H04'] = {"term_pairs_in_use": c.get('terminology')}
S['H04']['verdict'] = 'fail' if c.get('terminology') else 'pass'
S['MOT'] = {"pressure_wording": c.get('pressure'), "note": "Tier printed on the CV and profile for everyone (P23)."}
S['MOT']['verdict'] = 'pass' if not c.get('pressure') else 'fail'
P['summary'] = S
P['notes'] = ['Local stack, seeded data; unthrottled except probe 2 (Fast 3G, 4x CPU).', 'Probe 1: 126 routes x 3 configs = 378 page views; 42 were not-found states (portal-off or ids with no data) and are excluded from page measures.', 'Primary-styled = solid accent-orange background; the count is a heuristic.', 'Probe 3 counts a page found when a page result (not the generic Search for fallback) starting with its title is in the top 3; instance titles (a person, a venture) are included and will not be indexed by design.', 'Probe 8 changed the tester profile visibility on the local DB to cover each setting, and restored it.', 'The daily profile-view limit (300) was reached by the test runs and cleared on the local DB before probes 3, 4 and 8.']
json.dump(P, open('docs/ux-pilot/heuristics/probes.json', 'w'), indent=1, ensure_ascii=False)
for k, x in S.items(): print(k, x['verdict'], json.dumps({kk: vv for kk, vv in x.items() if kk != 'verdict'}, ensure_ascii=False)[:420])
