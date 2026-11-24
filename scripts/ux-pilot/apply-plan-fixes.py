"""Applies results.json plan_fixes to the UX test plan; writes docs/ux-pilot/ux-pilot-tasks.json (and a change log)."""
import json, sys
src = sys.argv[1] if len(sys.argv) > 1 else 'docs/ux-pilot/ux-pilot-tasks.json'
d = json.load(open(src))
T = {t['id']: t for t in d['tasks']}
log = []
def ed(i, field, new, why):
    old = T[i].get(field)
    T[i][field] = new
    log.append({"task": i, "field": field, "old": old, "new": new, "why": why})
def note(i, text):
    T[i]['notes'] = (T[i].get('notes', []) or []) + [text]
    log.append({"task": i, "field": "notes", "new": text})

STG = "staging"; PHONE = "real phone"
for i, env, why in [
    ("T003", [STG], "Google OAuth isn't configured on the local stack; use a university Google Workspace test account."),
    ("T011", [STG], "Needs the GitHub App and the github-worker."), ("T071", [STG], "Needs the GitHub App and the github-worker."),
    ("T013", [STG], "The claim email needs the notify worker. Locally, use the claim card on the welcome screen instead."),
    ("T045", [STG, PHONE], "Push needs VAPID keys, the notify worker and a real phone."),
    ("T046", [PHONE], "Android Chrome install prompt, or iOS Share > Add to Home Screen; headless browsers can't."),
    ("T097", [STG], "Reminders need the notify worker; the door check-in is S11's officer."),
    ("T115", [PHONE], "Needs a camera (BarcodeDetector) for scanning and the colour question."),
    ("T073", [STG], "The GitHub check is worker-driven; allow tasks.limits github_wait_minutes before judging the wait."),
    ("T074", [STG], "Peer routing runs on the proof-tasks-tick cron."), ("T075", [STG], "Peer routing runs on the proof-tasks-tick cron."),
]:
    T[i]['runs_on'] = env; note(i, why)

ed("T004", "task", T["T004"]["task"].replace("use the password 'password1'", "use the password 'password1', then 'password123'"), "'password1' only tests length; 'password123' (10+ characters, breached) tests the breached-password check.")
T["T009"]["questions"] = [q if "L1" not in q else "If you connected GitHub: on the skills step, what do you think 'L1', 'L2' and 'claimed' mean?" for q in T["T009"]["questions"]]
log.append({"task": "T009", "field": "questions", "why": "Without GitHub the skills step shows no levels."})
ed("T017", "task", "Open three pages you haven't visited yet that show a first-visit tip: Openings, a venture page, your CV, your score or the Privacy centre. Read the tip that appears.", "Skill swap, Paths and Credentials have no tips.")
ed("T018", "task", "You skipped the tour earlier. Find a way to watch it again. Then hide your getting-started progress for today and find where it went.", "The product offers 'Hide until tomorrow', not 'Hide checklist'.")
ed("T018", "done", "The tour is replaying, and you know where your progress went.", "Matches the new task.")
for f in d['flows']:
    for s in f['steps']:
        if s['id'] == 'F04.07a':
            log.append({"step": "F04.07a", "old": s['text']}); s['text'] = "Hide until tomorrow; it also hides when all items are done"
for i in ("T019", "T021"):
    ed(i, "setup", T[i]["setup"] + ". Include posts older than 2 hours (the feed's seed stage), or the tester sees almost none; the pilot seed ages them.", "New posts stay in the seed stage for 2 hours.")
ed("T020", "task", T["T020"]["task"].replace("Come back after 15 minutes", "Come back after 10 minutes"), "Answers lock after 10 minutes.")
ed("T023", "task", "One post isn't for you and one person posts too often: see less of each. Report the post titled '[UX test] report me' first, then mute its author.", "Mute target and report target are the same helper in practice.")
ed("T025", "task", T["T025"]["task"].replace("set your phone's text size to the largest", "set your browser's font size to the largest (Chrome: Settings > Accessibility > Text scaling), then your phone's text size"), "Browser font size and Android font scale behave differently.")
ed("T026", "task", T["T026"]["task"] + " Once you've seen what happens with it, remove the big photo so the post has one photo.", "Otherwise the post ends with two photos.")
ed("T030", "setup", "Helper comments on the tester's post. At least 3 helpers open the post in the app and answer its question positively (questions are assigned on view; the free public line needs 3+ positive answers).", "Questions are assigned when a post is viewed.")
ed("T032", "setup", "Helper shares two posts in chat: one normal, and one university-only post at the tester's university that its author then deletes (to show the unavailable card).", "A helper can't share a post the tester can't see.")
ed("T040", "task", "Try to message someone who isn't your friend: find Danish Helper in Explore. Then report a message from the helper marked '[UX test]'.", "Explore filters alone return nobody until a name is typed (R53).")
note("T047", "Acceptance is checked in T048; look at the bell first, not the venture page.")
note("T048", "In the pilot the venture page changed before any notification was seen; ask testers which they noticed first.")
ed("T062", "setup", "Any signed-in tester who has already done T079 (or reset the leaderboard opt-out after this task)", "T062 opts the tester out of leaderboards before T079.")
ed("T063", "task", "Check which devices are signed into your account and sign out of all devices. Then sign in again and sign out here, with Skilient open in two tabs.", "The product can't sign out everywhere except this device.")
ed("T068", "task", "Staff removed one of your test posts and restricted your test account. Find out why, and appeal one of the two decisions.", "Each decision has its own appeal.")
ed("T068", "done", "Your appeal of one decision has an outcome.", "Matches the new task.")
ed("T079", "setup", "Any signed-in tester; run before T062 (which opts out of leaderboards)", "Order dependency.")
ed("T084", "setup", "Tester on a Pro trial (on the free plan CV changes apply at the next monthly refresh)", "The done-when can't be met in one session on the free plan.")
ed("T086", "setup", "Helper on a Pro trial exports one genuine CV PDF, and prints a copy with a single character changed", "PDF export needs Pro.")
ed("T088", "setup", T["T088"]["setup"] + ". Tester hasn't created a venture today (daily create limit).", "Daily venture limit.")
ed("T104", "task", T["T104"]["task"].replace("for this academic year", "for this academic year (type the dates: 1 September to 30 June)"), "No academic-year default in the term form.")
ed("T107", "task", "It's the end of term. Hand the presidency to your co-officer, then check that the new President can confirm your officers' terms.", "Terms end at handover and the next President confirms them.")
ed("T107", "done", "Your co-officer is President and your officers' terms are confirmed or waiting for them.", "Matches the new task.")
ed("T117", "task", T["T117"]["task"].replace("log 3 volunteer hours", "log 2 volunteer hours (no more than the event's length)"), "Volunteer hours are capped at the event length.")
T["T116"]["status"] = "dropped"; note("T116", "Self check-in exists only for university events, not society events. Kept for the id; skip it until it's built.")

json.dump(d, open('docs/ux-pilot/ux-pilot-tasks.json', 'w'), indent=1, ensure_ascii=False)
json.dump(log, open('docs/ux-pilot/plan-changes.json', 'w'), indent=1, ensure_ascii=False)
print(len(log), 'changes;', len({x.get('task') for x in log if x.get('task')}), 'tasks')
