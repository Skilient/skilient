# Archive: the part 1 (S01, S02) results as applied. Rerunning rebuilds findings from this list only; use merge.py for later parts.
import json, glob, os
os.chdir('/home/user/skilient')
shots = sorted(os.listdir('docs/ux-pilot/shots'))
def S(tid): return [f"docs/ux-pilot/shots/{s}" for s in shots if s.startswith(tid+'-')]
def T(id, status, answers, findings, note, clicks=None, shortest=None):
    return {"id": id, "status": status, "answers": answers, "findings": findings, "note": note, "shots": S(id), "clicks": clicks, "shortest": shortest}
tasks = [
T("T001","Done",[
 "From the landing hero ('Pakistan's first social media platform exclusively for university students. Build with classmates, prove your skills with real work, and get recognised by recruiters'): a campus network where I build projects with classmates and get my skills verified for a CV.",
 "No field was unclear: name, university email (prefilled from the landing box), password with 'At least 10 characters'. The university was recognised under the email ('Signing up as a student of NUTECH. Not your university?'). Unexpected: on the throttled phone, what I typed in the first ~5 s vanished (R01).",
 "The page changed to 'Check your inbox: We sent a 6-digit code to u*****w@nutech.edu.pk… works for 15 minutes', with a 60 s resend timer. Locally the email arrived in under 1 s. The address is masked, so I couldn't check I'd typed it right (R38).",
 "Yes: it opens a full-height sheet 'Skilient User Agreement and Privacy Notice, Version 3'. I expected a short summary; it's long legal text and talks about recruiters and universities, which aren't on Skilient yet (R14)."],
 ["R01","R38","R14"],"Ran on Phone, Fast 3G + 4x CPU. Create account: pending 98 ms, result 702 ms; confirm code 64/795 ms. Ends on /onboarding/university 'Join your university'.",6,5),
T("T002","Done",[
 "Gmail: 'Use your university email.' (under the field, on blur and on submit). Typo after @ (nutech.edu.pkk, nutec.edu.pk): 'Your university isn't on Skilient yet. Request it'; after pressing Create account the same line without the 'Request it' link. Used email: 'This email is already registered. Sign in instead. Sign in' at the top of the form. Each told me what to do next except the typo case, which pointed me to the wrong next step.",
 "Yes, 'Request it' is clear, but for a typo it's the wrong advice: I'd have requested a university that doesn't exist instead of fixing my typo (R02). After submitting, the link disappeared (R03).",
 "No message blamed me; the typo one made me think NUTECH wasn't on Skilient.",
 "Not asked: no shared-domain university came up for any of these emails (F01.04b not reached)."],
 ["R02","R03","R04"],"",8,4),
T("T003","Not run",[
 "Email; I'd pick Google only if it were clearly my university account.",
 "Couldn't reach Google: locally Google sign-in isn't configured. Pressing 'Continue with Google' without ticking the agreement shows 'Accept the User Agreement to continue.' under the checkbox, which is clear. The line 'Only your university Google account works.' sits under the button.",
 "Not reached."],[],"Google OAuth isn't configured on the local stack; run on staging (plan fix).",1,None),
T("T004","Done",[
 "Yes for both: 'Accept the User Agreement and Privacy Notice to continue.' under the checkbox (aria-invalid + aria-describedby on the checkbox); 'Too short / Use at least 10 characters.' under Password (aria-invalid + describedby).",
 "Yes: the password message sat at 512-557 px on an 844 px screen.",
 "Wrong code twice: 'This code has expired or is wrong. Check it, or send a new one.' both times, identical, so I couldn't tell the second try was checked (R05). 'Send a new code in 57s' is a countdown button; I didn't need it. 'Too many attempts' wasn't reached in two tries.",
 "Other device: 'Confirm your email / Continue to confirm your university email / Confirm my email', then 'You're confirmed. You can close this tab. The tab where you signed up moves on by itself.' The phone tab, reloaded, still said 'Check your inbox' and restarted the 60 s timer (R06). Signing in later before confirming sent me straight to the code screen without saying why, and no new code was sent (R07). After the link was used, signing in went to onboarding."],
 ["R05","R06","R07"],"'password1' is 9 characters, so it tests length, not the breached-password check (plan fix).",14,10),
T("T009","Done",[
 "None felt unnecessary; each step's line is benefit-first ('Puts you in your university feed, leaderboards and events.'). Batch is a 22-year list and Department 38 options (R15).",
 "GitHub ('Skip for now'): connecting is a separate errand. On the skills step there was nothing to do: 'No skills detected yet', and no way to add a skill myself although the text says 'Skills you add yourself show as claimed' (R08).",
 "Without GitHub no levels showed, so I only learnt 'claimed' (from the explanation: earns no points until verified). L1/L2 weren't shown on this path.",
 "'Step 1 of 6 · about 6 min left' was right about steps; the minutes jumped 6, 5, 4, 2, 2, 1 (R12). 'Find your people' showed 'Open ventures: No open ventures yet' although two NUTECH ventures were recruiting (R09)."],
 ["R08","R09","R12","R15","R14"],"Welcome screen reached in 5 continues (shortest 5). Each step: pending 45-118 ms, result 682-830 ms.",8,6),
T("T010","Done",[
 "Opening / showed the landing page ('Open Skilient'); opening /feed resumed at step 3 (GitHub), the step after the last one I saved (R13).",
 "'That username is taken. Try another.' with no suggestion (R11).",
 "Yes: Back is a link, so the username and intro I'd typed on step 2 (not yet saved) were gone when I came back. Step 1's saved values were kept (R10).",
 "A 48 MB photo: 'Choose an image under 5 MB.' under 'Add a photo'; nothing uploaded, other fields kept."],
 ["R10","R11","R13"],"",12,9),
T("T011","Blocked",[
 "Yes, before connecting: 'We read the languages, frameworks and tools your own commits use, and your merged pull requests… We never write to your repositories, never store your code, and never show a private repository's name to anyone but you.'",
 "Reassured by the 'never' list; I'd still want to see the repository picker before agreeing.",
 "Not reached: the GitHub App install page is on github.com, which the local stack can't use, and the sync worker is an Edge Function that doesn't boot here."],[],"Needs a staging GitHub App (plan fix). Settings > GitHub showed the same copy and 'Connect GitHub'.",None,None),
T("T012","Done",[
 "'Welcome to Skilient, Nida… You build real projects with classmates, get your work verified, and get a CV that recruiters trust… Proof takes real work, so nothing here is instant. The tour takes about a minute.' Build real work / Get it verified / Carry the proof.",
 "Skipped to Home (the tour is T014's).",
 "Calm.",
 "With reduce motion on, the 20 welcome animations still exist but run at 0.01 ms (instant); nothing moved. Without it, 27 animations play."],["R14"],"Skip to Home: 929 ms to /feed on the throttled phone; Home first showed 'Loading…'.",1,1),
T("T013","Partly done",[
 "Not checked: the claim email is sent by the notify worker (Edge Function), which doesn't boot on this container. The row was queued (record_claims 1).",
 "On the welcome screen, without looking: '1 entry waiting. A society checked you in with this university email before you joined. Claim them onto your Record.' with Claim. One tap: '1 entry added to your Record'.",
 "That I attended 'Open-source evening (claim test)' with UX Pilot Developers Club, provable to anyone with its code at /verify. On /me/record it stays 'Signing…' with no expected time (R18)."],["R18"],"Signed up straight with the checked-in email instead of the email link.",3,2),
T("T014","Done",[
 "Home: my campus feed, the composer and my progress. Openings: everything I can join or apply to, one card per kind. Ventures: projects I build with others; finished ones count most. Chat: friends and venture teams. Me: profile, Record, skills, CV and score.",
 "Step 12 'Notifications' and step 13 'Your account' (generic). Step 2 now points at the search box (P07 fixed).",
 "About right per step but long: 14 steps across /feed, /openings and back; it introduces 5 of the 13 rail places (no Societies, Events, Skill swap, Explore, Leaderboard, Friends, Feedback)."],["R34"],"Tour started by itself on first /feed. Next: 14 clicks, each settled under 300 ms.",14,14),
T("T015","Partly done",[
 "The 'Spark · NEXT STEP · Earn 19 more points to reach Flare' chip on Home opens 'Your progress' as a sheet.",
 "Partly: '231.55 points, only you see this' (decimals); points per checklist item aren't on the sheet. The score page explains points well, but says '1 of 6 tiers reached' while I'm at Spark, the second tier (R19).",
 "'A confirmed contribution in 2 ventures (you have 1)' needs a second venture. 'Take this step' opened the explanation page /me/score, so I couldn't start a step from it (R20, same as P02)."],["R19","R20"],"'3 to do' (friend request, contribution to confirm, venture to endorse) is a link and was the real next step.",3,2),
T("T016","Done",[
 "'skill swap' and 'swap': first result 'Skill swaps (Openings)', so Enter opened /openings/swaps, not /swaps (P04). 'privacy' and 'privacy settings': only 'Settings', Enter opened /settings, one more click to Privacy centre (P05).",
 "Openings (compass) and Skill swap; Friends vs Societies look alike.",
 "Yes: all 13 rail items show a name and a one-line description on hover, and they're in the accessibility tree."],["R34"],"Desktop 1280x800.",6,4),
T("T017","Partly done",[
 "No tip appeared on Skill swap, Paths or Credentials (first-visit tips exist only on Openings, venture, CV, score and privacy).",
 "Credentials (fresh account): 'No credentials yet. Add a certificate below.' with the form right there: yes. Paths: 'Pick a path: Follow a role above to see its ladder'. Skill swap: the learn form, no empty-state action.",
 "No tip to close."],[],"Plan problem: these pages have no tips (plan fix).",3,3),
T("T018","Partly done",[
 "Settings: 'Replay tour: Walk through the app again' (and 'Replay welcome'). Found on the first look in Settings.",
 "Seconds: Settings > Replay tour restarts at 'Step 1 of 14' on /feed (915 ms).",
 "There's no 'Hide checklist' any more: the progress sheet offers only 'Hide until tomorrow', and Settings mentions no checklist. So I couldn't hide it for good, and nothing to get back (P03 changed)."],[],"Plan problem: F04.07a and the task describe a control that's gone.",3,2),
T("T019","Done",[
 "Ranks the post and is anonymous; the questions vary ('Did you learn something from this?', 'Was this interesting to you?', 'Would you want to see more like this?', 'Was this informative?'). Nothing says who sees my tick.",
 "'Answered · Change' in an empty well: looks finished but doesn't show what I picked (P14). Once, answering quickly: 'Take a moment to read the post first.' (F05.05a works).",
 "No; the questions did the job of a like.",
 "'[UX test] report me' got 'Did you learn something from this?', which doesn't fit a nonsense post. My own shipped post had no strip (Insights instead)."],["R22"],"15 posts answered; each answer settled in 60-700 ms. End: 'You're all caught up.'",15,15),
T("T020","Done",[
 "A 'Change' link after 'Answered'; it brings back the question. Obvious enough.",
 "After the lock (10 minutes in the product, not 15 as the task says), 'Change' simply disappears and the strip says 'Answered'; nothing says why (R23).",
 "Yes, for a few minutes, and say so when it's final."],["R23"],"The wait was simulated on the local DB by moving locked_at back.",3,2),
T("T021","Done",[
 "The active chip has aria-current and a pressed look.",
 "University: my campus; Global: posts from every university.",
 "Only my own shipped post: the Shipped filter carried over to the Global Feed (/feed?tab=global&filter=shipped), so a global post 'Open-source sprint this weekend' was hidden (R26)."],["R26"],"",3,3),
T("T022","Done",[
 "Right after voting: 'Friday (your vote) 100%… 1 vote'. As expected ('results after you vote' is stated).",
 "Yes: the reply sits under Bushra's comment, after 'Reply to Bushra Helper'.",
 "No: typing '@uxp_hel' suggested nothing; I had to know the username (R27)."],["R27"],"Reply posted after 1.5 s on the throttled phone.",6,5),
T("T023","Done",[
 "'Not for me' hides the post ('Hidden. You'll see fewer posts like this. Undo'); 'Mute' removes the person's posts ('You muted Chaudhry Helper. Their posts won't appear in your feeds. Undo'). Nothing says whether they're told.",
 "Yes: Spam, Harassment, Inappropriate content, Misinformation, Impersonation, Other, and 'Reports are private. The person isn't told who reported them.'",
 "'Thanks, we'll review this.' No when (R29). Muting the author first hid the post I had to report, so I opened it from its link."],["R29"],"",8,6),
T("T024","Done",[
 "Yes: every stop had a visible focus ring.",
 "None trapped, but 14 rail and header stops come before the feed and there's no skip link (R31); the ⋯ menu's arrow keys don't move between items (P15); Esc returns focus to ⋯.",
 "They read only 'Yes' and 'No', not the question (R32)."],["R31","R32"],"Desktop, keyboard only.",30,20),
T("T025","Partly done",[
 "No; both themes read well. The CV page showed 'We couldn't prepare your CV' locally (CV signing runs in an Edge Function).",
 "With a larger browser text size (root font 2x), boxes and icons grow but text stays the same size, so the phone dock labels overlap ('Openings' over 'Ventures') and the search box squashes (R33, same as P32).",
 "Dark: the orange stands out more."],["R33"],"'Largest text' emulated as a 2x root font size (what Chrome's font-size setting changes).",None,None),
]
F = [
 ("R01",3,"/signup (all server-rendered forms)","On Phone with Fast 3G and 4x CPU, the form looks ready after 1.7 s but hydrates at ~6.6 s; anything typed before that is wiped without notice (name and password came back empty; 'Enter your name' errors on submit).","Open /signup on a throttled phone, type name and password within 5 s, wait: fields are empty.","T001,T004","MOB,H05,DOH","Keep typed values through hydration (uncontrolled inputs or read DOM values on hydrate), or disable fields until ready.",""),
 ("R02",2,"/signup","A typo after @ (nutech.edu.pkk, nutec.edu.pk) says 'Your university isn't on Skilient yet. Request it', steering the student to request a university that doesn't exist.","Sign up with name@nutec.edu.pk.","T002","H09,H05","For a domain close to a live one, ask 'Did you mean @nutech.edu.pk?' before offering the request.",""),
 ("R03",2,"/signup","After submitting with an unknown domain, the 'Request it' link disappears from the message.","Type an unknown domain, press Create account.","T002","H09","Keep the request link in the submit-time message.",""),
 ("R04",1,"/signup","'This email is already registered. Sign in instead. Sign in' appears at the top of the form, not by the email field, with 'Sign in' twice.","Sign up with an existing email.","T002","H09,COP","Show it under the email field: 'This email already has an account. Sign in'.",""),
 ("R05",2,"/signup/verify","A second wrong code shows the identical message; nothing shows the new attempt was checked or how many are left.","Enter a wrong code twice.","T004","H01,H09","Re-announce the message (live region) and say attempts left.",""),
 ("R06",2,"/signup/verify","After the link is used on another device ('The tab where you signed up moves on by itself'), the phone tab, reloaded, still says 'Check your inbox' and restarts the resend timer.","Sign up on phone, open the email link on desktop and confirm, reload the phone tab.","T004","H01,H04","On load and on focus, check confirmation and move on.",""),
 ("R07",2,"/signin","Signing in before confirming the email goes straight to the code screen with no reason given, and no new code is sent although a fresh 60 s timer suggests one was.","Sign up, close, sign in later.","T004","H09,H01","Say 'Confirm your email first. We sent a new code to …' and send it.",""),
 ("R08",3,"/onboarding/skills, /me/skills","The step says 'Skills you add yourself show as claimed', but there is no way to add a skill anywhere; without GitHub the step is empty.","Skip GitHub, reach step 4.","T009,T070","COP,H04,LRN","Add 'Add a skill you have' (claimed) to the step and to /me/skills, or remove the promise.","P27"),
 ("R09",3,"/onboarding/people","'Open ventures at <university>: No open ventures yet' always; the step never loads ventures, though two NUTECH ventures were recruiting.","Finish onboarding at NUTECH with recruiting ventures present.","T009","H04,TRU,EMP","Load recruiting university/public ventures with open roles into the step.",""),
 ("R10",2,"/onboarding/profile","Back is a link, so unsaved username and intro typed on step 2 are lost.","Type a username and intro, press Back, then Continue.","T010","H03,H05","Save drafts on Back (or keep them in the form state).",""),
 ("R11",1,"/onboarding/profile","'That username is taken. Try another.' offers no suggestion.","Type an existing username.","T010","H05","Suggest two free variants.",""),
 ("R12",1,"/onboarding","Time left jumps (6, 5, 4, 2, 2, 1 min).","Walk the wizard.","T009","H01","Base it on remaining steps evenly.",""),
 ("R13",1,"/","A signed-in student mid-onboarding who opens / sees the marketing page ('Open Skilient'), not their next step.","Close mid-onboarding, open skilient.com.","T010","NAV","Redirect signed-in users to their current step or Home.",""),
 ("R14",2,"/, /signup agreement, /onboarding/done","Copy promises recruiters ('get recognised by recruiters', 'a CV that recruiters trust') while the recruiter portal is off.","Read the landing hero and welcome screen.","T001,T009,T012","COP,TRU","Drop or soften recruiter claims while portals are off.","P20"),
 ("R15",1,"/onboarding/university","Batch list has 22 years (2011-2032) and Department 38 options with no search.","Open the selects.","T009","HCK","Default to likely batches; add type-ahead search to Department.",""),
 ("R18",2,"/me/record","A new entry shows 'Signing…' with no idea how long it takes.","Claim an entry and open the Record.","T013","H01","'Signing, usually within a minute' and refresh when sealed.",""),
 ("R19",2,"/feed progress, /me/score","Points shown with decimals ('231.55 points'); /me/score says '1 of 6 tiers reached' while the student is at Spark (tier 2).","Open the progress sheet and score page as a Spark student.","T015","H04,TRU","Round points; count tiers reached including the current one.","P01"),
 ("R20",2,"/feed progress","'Take this step' opens the score explanation, not an action.","Progress > Take this step.","T015","H06,FIT","Link the next step to its action.","P02"),
 ("R22",2,"Post survey strip","After answering, the strip shows 'Answered · Change' in an empty well, not the answer.","Answer any post.","T019","H01,COP","Show 'You said Yes · Change'.","P14"),
 ("R23",2,"Post survey strip","When the change window ends (10 min), 'Change' disappears with no explanation.","Answer, wait 10 minutes, reload.","T020","H01,H03","'Answers are final after 10 minutes' on hover/under the strip.",""),
 ("R26",2,"/feed","Switching to Global Feed keeps the active filter (Shipped), so the Global Feed looks nearly empty.","Filter Shipped, then Global Feed.","T021","H01,AFF","Reset the filter on feed switch, or show it clearly with a clear button.",""),
 ("R27",2,"Comments","Typing @ suggests no names; you must know the exact username.","Reply with '@uxp_hel'.","T022","JAK,H06","Autocomplete friends and thread participants.",""),
 ("R29",1,"Report sheet","After reporting: 'Thanks, we'll review this.' No timeline or where to see the outcome.","Report a post.","T023","H01,SAF","'Usually within 2 days; you'll get a notification.'",""),
 ("R31",2,"App shell (desktop)","Keyboard users pass 14 rail and header stops before the feed; no skip link in the app shell.","Tab from page load on /feed.","T024","ACC,FIT","Add 'Skip to content' to the app shell.",""),
 ("R32",1,"Post survey strip","Tick and cross are named only 'Yes' and 'No'.","Focus the tick with a screen reader.","T024","ACC","Name them 'Yes: <question>' or group with the question as label.",""),
 ("R33",3,"All pages","With a larger browser font size, controls (rem) grow but text (px) doesn't; the phone dock labels overlap and the search box squashes.","Set the browser default font to 32px; open /feed on a phone.","T025","ACC,MOB","Size text in rem.","P32"),
 ("R34",2,"Ctrl K, tour","'swap' opens 'Skill swaps (Openings)' first; 'privacy' finds only Settings. The tour introduces 5 of 13 rail places.","Ctrl K, type swap / privacy.","T016,T014","H07,LRN","Rank exact page names first; index settings sub-pages; one tour step for the rail's lower group.","P04"),
 ("R38",2,"/signup/verify","The code screen masks the address the student just typed (u*****w@…), so a typo can't be spotted.","Sign up and read the code screen.","T001","H05","Show the full address to the person who just typed it.",""),
 ("R40",2,"/feed","New posts stay in a 2-hour 'seed' stage shown only to a sample; a brand-new student saw 2 posts while ~20 existed at their university.","Sign up and open Home within 2 hours of others posting.","T012,T019","EMP,H01","Let posts from a student's own university reach small universities without the seed gate, or fill quiet feeds with older posts.",""),
]
findings=[{"id":a,"severity":b,"where":c,"what":d,"repro":e,"tasks":f,"principles":g,"fix":h,"same_as":i} for a,b,c,d,e,f,g,h,i in F]
cw=[
 {"step":"F01.04c","task":"T002","q":3,"why":"For a typo, 'Request it' is the visible control, and it leads to requesting a university that doesn't exist."},
 {"step":"F01.08c","task":"T004","q":4,"why":"After confirming elsewhere, the original tab still says 'Check your inbox'."},
 {"step":"F02.03b","task":"T004","q":4,"why":"Signing in unconfirmed lands on the code screen without saying why or sending a code."},
 {"step":"F03.05a","task":"T009","q":2,"why":"There is no control to add a claimed skill."},
 {"step":"F03.07","task":"T009","q":4,"why":"Open ventures always empty, so nothing to act on."},
 {"step":"F03.02a","task":"T010","q":4,"why":"Back drops what was typed on the current step."},
 {"step":"F04.06","task":"T015","q":3,"why":"'Take this step' sounds like an action but opens an explainer."},
 {"step":"F04.07a","task":"T018","q":2,"why":"No 'Hide checklist' control exists; only 'Hide until tomorrow'."},
 {"step":"F04.04","task":"T017","q":2,"why":"No tip appears on Skill swap, Paths or Credentials."},
 {"step":"F04.08","task":"T016","q":4,"why":"'privacy' leads to Settings, not the Privacy centre; 'swap' to the Openings category."},
 {"step":"F05.07","task":"T019","q":4,"why":"'Answered' without the answer: not sure it counted."},
 {"step":"F05.06b","task":"T020","q":4,"why":"Change disappears without saying the answer is now final."},
 {"step":"F05.02","task":"T021","q":4,"why":"The Global Feed keeps the Shipped filter and looks empty."},
 {"step":"F05.09","task":"T022","q":2,"why":"No mention suggestions appear when typing @."},
 {"step":"F05.10","task":"T024","q":2,"why":"Arrow keys don't move within the ⋯ menu."},
]
plan=[
 {"tasks":"T003","change":"Google OAuth isn't configured locally; run T003 on staging with a university Google Workspace test account."},
 {"tasks":"T011,T071","change":"Needs a staging GitHub App and running workers; the local stack can't reach github.com and Edge Functions don't boot in the cloud container."},
 {"tasks":"T013","change":"The claim email needs the notify worker; locally use the welcome screen's claim card, or run on staging."},
 {"tasks":"T004","change":"Use 'password123' (10+ characters, breached) to test the breached-password check; 'password1' only tests length."},
 {"tasks":"T009","change":"Ask about L1/L2 only of testers who connected GitHub; without it the step shows no levels."},
 {"tasks":"T017","change":"Name pages that have first-visit tips: Openings, a venture page, CV, score, Privacy centre."},
 {"tasks":"T018","change":"The product now offers 'Hide until tomorrow', not 'Hide checklist'; update F04.07a and the task ('hide your progress for today; find where it went')."},
 {"tasks":"T019,T021","change":"Setup must include posts older than 2 hours (seed stage) or the tester sees almost none; the seed script ages them."},
 {"tasks":"T020","change":"The product locks answers after 10 minutes, not 15; say 'come back after 10 minutes' or 'later'."},
 {"tasks":"T023","change":"Mute and the report target are the same helper in practice; say 'report first, then mute', or use a different person to mute."},
 {"tasks":"T025","change":"Say which text-size setting (browser font size vs Android font scale); they behave differently."},
]
res={"run":"local","date":"2026-11-23","tasks":tasks,"cw":cw,"findings":findings,"plan_fixes":plan,"production_recheck":[]}
p='docs/ux-pilot/results.json'
if os.path.exists(p):
    old=json.load(open(p)); ids={t['id'] for t in tasks}
    res['tasks']=[t for t in old['tasks'] if t['id'] not in ids]+tasks
json.dump(res,open(p,'w'),indent=1,ensure_ascii=False)
print(len(res['tasks']),len(findings),len(cw))
