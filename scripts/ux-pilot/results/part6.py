"""Part 6: heuristic and screen-review findings into results.json, the per-principle verdicts (heuristics.json) and the route x principle scorecard (scorecard.csv)."""
import json, csv, re, sys, collections
sys.path.insert(0, 'scripts/ux-pilot'); from merge import merge, F
P = json.load(open('docs/ux-pilot/heuristics/probes.json')); S = P['summary']
H = json.load(open('/root/.claude/uploads/00a012a9-55d3-58e9-bfc3-0a5d55dd6652/684a2cf9-ux-pilot-tasks.json'))['heuristics']
codes = [h['code'] for h in H]

HF = [
F("H01",3,"Ctrl K (all pages)","Only 26 of 58 student page titles are in the top 3 results (45%); Privacy, Security, Your score, Your skills, Billing, Delete account, Appeals and Edit profile fall back to 'Search for … in Explore', and Enter then opens Explore.","Ctrl K, type a page title.","probe 3","H07","Index every page by title and synonyms; rank exact page names first.","P04"),
F("H02",3,"Phone navigation","Crawling visible links from Home on a phone never reaches Explore, Events, Societies or Tickets within 4 taps; Appeals isn't linked from any page on phone or desktop (only from a restriction banner).","Phone, follow visible links from /feed.","probe 4","NAV","Add Events, Societies and Explore to a 'More' place in the dock; link Appeals from Settings and the Privacy centre."),
F("H03",2,"/settings/privacy","Privacy controls are 3 taps from Home (account menu, Settings, Privacy centre); the bar is 2.","From /feed find the Privacy centre.","probe 8","PRV,NAV","Put 'Privacy' in the account menu."),
F("H04",2,"/explore, /leaderboard, /me/paths, /ventures, society manage, event stepper","At 320 px these pages scroll sideways (WCAG 1.4.10 reflow).","Set the viewport to 320 px.","probe 1","ACC,MOB","Let filter rows and tab rows wrap."),
F("H05",2,"26 pages incl. /feed, /chat, /explore, /me/score, /openings","With the WCAG text-spacing override, text in fixed-height or ellipsis boxes is clipped.","Apply line-height 1.5, letter-spacing .12em, word-spacing .16em.","probe 1","ACC","Let chips, tabs and buttons grow in height; avoid fixed heights on text."),
F("H06",2,"/chat/[id], /feed, /me/cv, onboarding","Targets under 24 px on 49 page views: message timestamps and Reply/React/Report links (78x23), feed dates, CV section arrows.","Measure interactive elements at 390 px.","probe 1","FIT,ACC","Give links at least 24 px of hit area; move message actions behind a long-press or ⋯."),
F("H07",2,"/profile/[username]","'Unfriend' sits 8 px from the primary 'Message' button with equal size.","Open a friend's profile.","probe 1, screens","FIT,AFF","Move Unfriend and Block into a ⋯ menu."),
F("H08",2,"/settings/notifications, society manage, /settings/billing, /settings/security","More than one primary-styled action on 10 screens (5 on notification settings, 4 on society manage).","Count solid-orange actions per screen.","probe 1","H08,AES","One filled action per screen; others tonal."),
F("H09",2,"/societies/[slug]/manage/payments, /notifications, /ventures, /teach/*","15 controls without an accessible name (payment type select, account inputs and buttons; icon-only links).","Read names with a screen reader.","probe 1","H06,ACC","Label each control."),
F("H10",3,"Destructive controls (12)","No confirm, undo or way back: delete a comment, unfollow a society, unfollow a path, dismiss a suggestion, delete a chat message, revoke a Record share link, accept/decline applications, confirm a contribution, cancel an event, offer the handover, issue entries, decline an induction applicant.","Use each control.","probe 5, tasks","H03,H05","Confirm the irreversible ones; undo toast for the rest.","R49"),
F("H11",1,"Leave society, Cancel registration, End swap","These use the browser's native confirm box, unlike every other dialog.","Leave a society.","probe 5, tasks","AES,H04","Use the app's dialog.","R85"),
F("H12",2,"Report sheet","Esc closes the report sheet but focus jumps to the top search box, not back to Report.","Open Report, press Esc.","probe 5","ACC","Return focus to the trigger."),
F("H13",3,"/feed composer offline","Posting while offline replaces the whole page with 'This page didn't load. Something went wrong on our side.'; the composer and draft are gone.","Go offline, post.","probe 6","H09,H05,MOB","Catch the failed action, keep the draft, say 'You're offline; it'll post when you're back'."),
F("H14",2,"/ops","A student opening /ops is told 'This area needs two-factor. Turn it on below…', revealing the staff area, instead of not found.","Open /ops as a student.","probe 6","H09,SAF","404 for non-staff before the two-factor check."),
F("H15",1,"/ventures/new","The title field stops at 80 characters without a counter or message.","Type a long title.","probe 6","H05","Show a counter near the limit."),
F("H16",2,"Empty states","Some empty-state actions lead to another empty page: Openings > Paths → /me/paths ('Pick a path'), Openings > Skill swaps → /swaps; Appeals has no action.","As a new student, follow each empty-state action.","probe 7","EMP","Point each action at the step that fills the list."),
F("H17",2,"/profile/[username] (friends-only)","A friends-only profile tells strangers it's shared 'with their university or friends only'.","Set Friends only; open as a stranger.","probe 8","PRV,TRU","Word the line per setting."),
F("H18",3,"/me/score, /settings/privacy, /notifications, /settings/github","Four contradictions: '1 of 6 tiers reached' at Spark; an expired share link counted as active; bell 44 unread vs 22 marked on the page; 'Not synced yet' beside 12 commits of evidence.","See probe 9.","probe 9","TRU,H04","One source for each fact.","R19"),
F("H19",2,"Privacy centre, CV, notification settings, Billing, sign-up","10 strings mention recruiters, hiring or company names while the recruiter portal is off.","Read those pages.","probe 10","COP,TRU","Hide portal wording behind the portals flag.","P20"),
F("H20",2,"Copy across pages","Two terms for one concept: 'Class of 2028' and 'Batch of 2028'; 'Skill swap' and 'Skill swaps'; 'Openings' and 'Opportunities'.","Compare labels.","probe 10","H04","Pick one per concept."),
F("H21",1,"Copy outside legal pages","26 sentences over 20 words outside Terms and Privacy (e.g. leaderboard and score explanations).","Read the Privacy centre and score page.","probe 10","COP","Split into two sentences."),
F("H22",2,"All actions","Only 56% of 592 timed actions responded or showed progress within 400 ms; 77 showed no pending sign at all; background jobs (Record signing, GitHub check, sync, CV refresh) show no expected time.","See timings.jsonl.","probe 2, tasks","DOH,H01","Disable and label buttons while pending; ETAs on every job.","R41"),
F("H23",1,"/feed","Cold LCP on the throttled phone is 2.8 s (bar 2.5 s); every other core page is 0.8–1.2 s.","Fast 3G, 4x CPU, open /feed.","probe 2","MOB","Defer the composer and progress chip below the first post."),
F("H24",1,"/explore, /swaps, /settings/profile","Native selects with 157–284 options (skills, universities) and no search.","Open the Skill or University select.","probe 1","HCK","Searchable combobox.","P11"),
F("H25",1,"/teach/ideas/new","11 fields in one ungrouped form.","Open the idea form.","probe 1","MIL","Group under headings or split into steps."),
F("H26",2,"/feed (phone)","The composer and progress chip fill the first screen; the first post starts below the fold.","Open Home on a 390 px phone.","screens","H08","Collapse the composer to one line until tapped."),
F("H27",2,"Venture, Openings, score, CV, Privacy (phone)","First-visit tip cards sit above the page content on every visit until dismissed, pushing the page below the fold; on /me/score the score itself starts below the fold behind a tip, a banner and a 3D coin.","Open /me/score on a phone.","screens","H08,AES","Show tips once, collapsed; put the number first."),
F("H28",2,"/chat/[id]","Reply · React · Report/Delete text links under every message make long threads noisy and the targets tiny.","Open a busy chat.","screens","AES,FIT","Show actions on long-press or hover."),
F("H29",1,"/societies/[slug]","'Following' is plain text beside a filled 'Join'; 'Report' sits on a different baseline.","Open a society you follow.","screens","AES,AFF","Same button family; align."),
F("H30",1,"/me/paths","The selected path card is outlined in blue, the only blue on the page, so it reads as a focus ring.","Open a path.","screens","AES","Use the accent for selection."),
F("H31",1,"/events/[id]/ticket","An ended, checked-in ticket still offers 'Get reminded on your phone?'.","Open a past ticket.","screens","PKE","Hide the reminder offer after the event."),
F("H32",1,"/notifications","Two identical lines 'New on your Record: [UX test] Speed coding contest' (one Attended, one Result) read as a duplicate.","Get two entries from one event.","screens","PKE,H04","Name the entry kind."),
F("H33",1,"/events/[id]/check-in (phone)","A large empty gap above 'Scan a ticket' pushes the input below the fold.","Open the console on a phone.","screens","AES","Remove the gap."),
F("H34",1,"/ventures","A skill name in the corner of each card ('React') is styled like a button.","Open Ventures.","screens","AFF","Style skills as tags."),
F("H35",1,"/events/[id]/manage","'Check-in' is a black filled button beside the orange primary style: two primary styles.","Open event manage (light).","screens","H08,AES","One primary style."),
F("H36",1,"/signup (phone)","The agreement label wraps oddly with a stray full stop on its own line.","Open sign-up at 390 px.","screens","AES","Fix the label layout."),
F("H37",2,"Phone account menu","Feedback isn't in the phone dock or the account menu; on desktop it's one tap in the rail.","Look for Feedback on a phone.","tasks, probe 4","H10","Add Feedback to the account menu."),
]
merge(findings=HF)

R = json.load(open('docs/ux-pilot/results.json'))
allF = R['findings']
# LRN: clicks vs shortest path.
lr = [(t['id'], t['clicks'] / t['shortest']) for t in R['tasks'] if t.get('clicks') and t.get('shortest')]
over = [i for i, r in lr if r > 1.5]

def fids(code):
    return sorted({f['id'] for f in allF if code in [c.strip() for c in (f['principles'] or '').split(',')]}, key=lambda x: (x[0], int(re.sub(r'\D', '', x) or 0)))
def worst(code):
    s = [f['severity'] for f in allF if code in [c.strip() for c in (f['principles'] or '').split(',')]]
    return max(s) if s else 0

meas = {
 'H01': f"pending within 100 ms {S['H01']['pending_within_100ms']:.0%}, result within 1 s {S['H01']['result_within_1s']:.0%} of 592 actions; 4 background jobs show no expected time",
 'H02': f"{sum(1 for t in S['H02']['terms'] if t['explainedSomewhere'])} of {len(S['H02']['terms'])} product terms explained where they appear; L1/L4, corroborated, sealed, Taught unexplained",
 'H03': f"{S['H03']['with_confirm_undo_or_way_back']} of {S['H03']['controls_judged']} destructive controls have a confirm, undo or way back",
 'H04': f"{len(S['H04']['term_pairs_in_use'])} concepts with two terms; 4 cross-page contradictions",
 'H05': "no duplicate on double-click (composer); no leave warning on 3 forms; limits shown after submit for files and venture creation",
 'H06': f"0 icon-only controls unnamed; {S['H06']['unnamed_controls']} other controls unnamed; next steps without links (score requirements, 'Take this step')",
 'H07': f"{S['H07']['rate']:.0%} of student page titles in Ctrl K top 3 ({S['H07']['in_top3']}/{S['H07']['pages']}); state in URL for feed filters, Explore and Openings",
 'H08': f"{S['H08']['pages_with_more_than_one_primary']} of {S['H08']['pages_390']} phone screens with 2+ primaries; first post / score below the fold on Home and Score",
 'H09': "field errors name cause and fix with aria-invalid + describedby on sign-up, feedback, contributions; offline post shows a server error; some messages after submit only",
 'H10': "Feedback one tap on desktop (rail); not reachable from the phone dock or account menu",
 'ACC': f"0 axe WCAG 2.2 AA violations on {S['ACC']['page_configs']} page views; no sideways scroll at 390; {len(S['ACC']['reflow320_fail'])} pages fail 320 px reflow; {len(S['ACC']['text_spacing_clipped_routes'])} clip under text spacing; keyboard task T024 completable",
 'MOB': f"LCP max {S['MOB']['lcp_max_cold']} ms (feed, cold); CLS ≤ 0.071; typing before hydration (~6.6 s) is wiped",
 'LRN': f"{len(over)} of {len(lr)} tasks over 1.5x the shortest path ({', '.join(over[:8])})",
 'NAV': f"desktop: all crawled pages within 3 clicks; phone: Explore, Events, Societies, Tickets unreachable by visible links; Appeals orphaned; current place marked on all but 2 pages",
 'TRU': f"{len(S['TRU']['contradictions'])} contradictions in {S['TRU']['checks']} cross-page checks",
 'PRV': "45 viewer x setting cells all match the setting; one wrong 'why hidden' line; privacy controls 3 clicks from Home",
 'AFF': "no pointer cursors on non-focusable elements; 2 visual affordance mix-ups (skill tag as button, Following as plain text)",
 'COP': f"0 real typos in {S['COP']['strings']} strings; {len(S['COP']['off_flag_mentions'])} off-flag recruiter mentions; {S['COP']['long_outside_legal']} long sentences outside legal pages",
 'EMP': f"{S['EMP']['with_title_explanation_action']} of {S['EMP']['empty_states']} empty states have title, explanation and action; {len(S['EMP']['action_leads_to_empty'])} actions lead to another empty page",
 'MOT': "no pressure or shame wording; tier printed on the CV twice for every student (P23)",
 'SAF': "Report/Block one tap on comment, message, profile, venture, society, event; 2 on posts; block holds in all 12 surfaces checked both ways",
 'HCK': "rail 13 items (desktop, grouped by level), phone dock 5; 5 native selects of 22–284 options with only first-letter type-ahead",
 'FIT': f"{S['FIT']['pages_with_targets_under_24px']} page views with targets under 24 px; Unfriend 8 px from Message",
 'JAK': "slips seen: offline chat message looks sent; no @-mention suggestions; Enter-in-place date links; native confirm boxes",
 'DOH': f"{S['DOH']['respond_or_progress_within_400ms']:.0%} respond or show progress within 400 ms (bar 95%)",
 'PKE': "confirmed: post ('Posted.'), registration (ticket page), venture complete (Shipped), welcome; missing: application sent, society join, induction decision notification, event feedback, notice sent",
 'TES': "no data asked twice in sign-up/onboarding; reset password doesn't carry the email from sign-in; event departments typed by hand though known",
 'MIL': "most steps ≤ 7 fields or grouped; teacher idea form 11 ungrouped; event stepper 7 steps",
 'AES': "consistent neumorphic system in both themes; issues: multiple primary styles, blue selection, chat action noise, empty gaps, native dialogs",
}
verd = {'H01':'fail','H02':'partial','H03':'fail','H04':'fail','H05':'fail','H06':'partial','H07':'fail','H08':'partial','H09':'partial','H10':'partial','ACC':'partial','MOB':'fail','LRN':'partial' if len(over) <= len(lr)*0.25 else 'fail','NAV':'fail','TRU':'fail','PRV':'partial','AFF':'partial','COP':'fail','EMP':'partial','MOT':'partial','SAF':'pass','HCK':'partial','FIT':'fail','JAK':'fail','DOH':'fail','PKE':'fail','TES':'partial','MIL':'partial','AES':'partial'}
evid = {'ACC':'probes.json pages, summary.ACC; T024','H07':'probes.json ctrlk','NAV':'probes.json crawl','DOH':'probes.json performance; timings.jsonl','MOB':'probes.json performance; R01','TRU':'probes.json invariants','H03':'probes.json destructive','H09':'probes.json errors','EMP':'probes.json empty','PRV':'probes.json viewers','SAF':'probes.json viewers.reach, surfaces','COP':'probes.json copy','H04':'probes.json copy.terminology, invariants','H02':'probes.json copy.terms','LRN':'results.json tasks clicks/shortest','AES':'heuristics/screens','AFF':'probes.json pages; screens','H08':'probes.json pages; screens','PKE':'tasks; screens'}
out = []
for h in H:
    c = h['code']
    out.append({"code": c, "verdict": verd[c], "pass_bar": h['pass'], "measure": meas[c], "worst": worst(c), "findings": fids(c), "evidence": evid.get(c, 'results.json tasks and findings')})
json.dump({"principles": out}, open('docs/ux-pilot/heuristics/heuristics.json', 'w'), indent=1, ensure_ascii=False)

# Scorecard: route x code, worst severity seen there; 0 where checked and clean; blank where not applicable.
routes = sorted({r['route'] for r in P['pages']})
real = {r['route'] for r in P['pages'] if not r.get('notFound') and not r.get('error')}
KEY = [  # where-text pattern -> routes
 (r'composer|/feed\b|Home|survey strip|Post survey', ['/feed']), (r'/post/\[id\]|Comments|Report sheet|Share', ['/post/[id]']), (r'/signup\b', ['/signup']), (r'/signup/verify', ['/signup/verify']), (r'/signin', ['/signin']),
 (r'/onboarding', ['/onboarding/[step]', '/onboarding/done']), (r'/me/score|score page', ['/me/score']), (r'/me/skills|Skill drawer', ['/me/skills']), (r'/me/paths', ['/me/paths']), (r'/me/record', ['/me/record']), (r'/me/cv|Signed CV|CV sections|/me/cv', ['/me/cv']),
 (r'/me/credentials', ['/me/credentials']), (r'/me/tasks', ['/me/tasks/[id]', '/me/tasks/reviews/[id]']), (r'/explore', ['/explore']), (r'/friends', ['/friends']), (r'/chat', ['/chat', '/chat/[threadId]']), (r'/notifications', ['/notifications']),
 (r'/settings/privacy|Privacy centre', ['/settings/privacy']), (r'/settings/notifications', ['/settings/notifications']), (r'/settings/profile', ['/settings/profile']), (r'/settings/security', ['/settings/security']), (r'/settings/github', ['/settings/github']), (r'/settings/billing|Billing', ['/settings/billing']),
 (r'/ventures/new', ['/ventures/new']), (r'/ventures/\[id\]|venture', ['/ventures/[id]', '/ventures/[id]/team', '/ventures/[id]/contributions', '/ventures/[id]/manage']), (r'/ventures\b', ['/ventures']), (r'/requests', ['/requests']),
 (r'/openings', ['/openings', '/openings/[category]']), (r'/societies/new', ['/societies/new']), (r'/societies/\[slug\]/manage|society manage|handover', ['/societies/[slug]/manage']), (r'inductions', ['/societies/[slug]/inductions/[id]', '/societies/[slug]/inductions/new']), (r'/societies/\[slug\]|society', ['/societies/[slug]']),
 (r'Event stepper|events/new', ['/societies/[slug]/events/new']), (r'/events/\[id\]/manage|close-?out|duplicate', ['/events/[id]/manage']), (r'check-in', ['/events/[id]/check-in']), (r'ticket', ['/events/[id]/ticket']), (r'/events\b', ['/events']),
 (r'/swaps', ['/swaps', '/swaps/[id]']), (r'/verify', ['/verify', '/verify/[code]']), (r'/leaderboard', ['/leaderboard']), (r'/profile', ['/profile/[username]']), (r'/me\b|Me hub', ['/me']), (r'/agreement', ['/agreement']), (r'/feedback', ['/feedback']), (r'/forgot-password', ['/forgot-password']), (r'/ops', []), (r'/', ['/']),
]
ALLSTUDENT = sorted({r['route'] for r in P['pages'] if r['role'] == 'student'} & real)
grid = {r: {c: '' for c in codes} for r in routes}
def put(r, c, s):
    if r in grid and c in grid[r]: grid[r][c] = str(max(int(grid[r][c] or 0), s))
for r in real:
    for c in ['ACC', 'H06', 'H08', 'FIT', 'HCK', 'MIL', 'AFF', 'COP']: put(r, c, 0)
    if r in ALLSTUDENT: put(r, 'NAV', 0); put(r, 'H07', 0)
for f in allF:
    w = f['where'] or ''
    hits = set()
    if re.search(r'All pages|App shell|All actions|Ctrl K|Copy across|Phone navigation', w): hits |= set(ALLSTUDENT)
    for pat, rs in KEY:
        if re.search(pat, w): hits |= set(rs); break
    for c in [x.strip() for x in (f['principles'] or '').split(',') if x.strip() in codes]:
        for r in hits: put(r, c, f['severity'])
# Probe-derived cells.
for r in P['pages']:
    if r.get('notFound') or r.get('error'): continue
    rt = r['route']
    if r.get('reflow320', {}).get('sideways'): put(rt, 'ACC', 2)
    if r.get('textSpacing', {}).get('clipped'): put(rt, 'ACC', 2)
    if r.get('smallCount'): put(rt, 'FIT', 2 if r['smallCount'] > 5 else 1)
    if r.get('destructiveNearPrimary'): put(rt, 'FIT', 2)
    if r.get('primaries', 0) > 1: put(rt, 'H08', 2)
    if r.get('unnamedCtrls'): put(rt, 'H06', 2); put(rt, 'ACC', 2)
    if r.get('longSelects'): put(rt, 'HCK', 1)
for x in P['ctrlk']['pages']:
    if not x['inTop3']: put(x['route'], 'H07', 2)
for dev, v in P['crawl'].items():
    for o in v['orphans']: put(o, 'NAV', 3)
with open('docs/ux-pilot/heuristics/scorecard.csv', 'w', newline='') as fh:
    w = csv.writer(fh); w.writerow(['route'] + codes)
    for r in routes: w.writerow([r] + [grid[r][c] for c in codes])
print(collections.Counter(p['verdict'] for p in out), 'LRN over', len(over), 'of', len(lr))
for p in out: print(p['code'], p['verdict'], p['worst'], len(p['findings']))
