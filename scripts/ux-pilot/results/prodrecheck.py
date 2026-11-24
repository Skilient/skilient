"""Part 4: production findings P01-P36 re-checked on the local stack."""
import json, os
os.chdir('/home/user/skilient')
R=[
("P01","confirmed","Score page still says '1 of 6 tiers reached' at Spark (R19); formula v2 shown consistently in banner and footer; the held-score/'rose quickly' text didn't appear (no flags locally)."),
("P02","confirmed","'Take this step' opens /me/score; requirements aren't links (T015, T078)."),
("P03","not reproduced","Phone progress sheet only offers 'Hide until tomorrow'; no permanent 'Hide checklist' was reachable at 1300 px (T018)."),
("P04","confirmed","Ctrl K 'swap' opens Openings > Skill swaps first (T016)."),
("P05","confirmed","Ctrl K 'privacy' finds only Settings (T016)."),
("P06","confirmed","13 rail items with tooltips; the 14-step tour introduces Home, Openings, Ventures, Chat, Me, notifications and account only (T014)."),
("P07","not reproduced","Tour step 2 now points at the top-bar search box (T014)."),
("P08","confirmed","The last tour step offers 'Write your first post' to an account that already has a post (T014)."),
("P09","confirmed","'Pick a path: Follow a role above to see its ladder', yet opening a role shows its ladder without following (T017, T072)."),
("P10","not reproduced","Locally the bank has tasks for each square (seeded and from config); data-dependent in production."),
("P11","confirmed","Skill swap 'I want to learn' is a plain select of ~150 skills (T017, T076)."),
("P12","not reproduced","No Yearbook in the rail (removed by migration 20261124000000)."),
("P13","not reproduced","The search button reads 'Search or jump to… Ctrl K' with no conflicting aria-label (Linux)."),
("P14","confirmed","'Answered · Change' in an empty well, without the answer (T019)."),
("P15","confirmed","Arrow keys don't move within the ⋯ menu; Esc returns focus (T024)."),
("P16","confirmed","Batch + skill filters return nothing until 2 letters are typed (T041)."),
("P17","confirmed","Me hub tiles: Profile, Skills, My work, CV, Score, Credentials, Leaderboard, Friends, Feedback; no Record, Paths or Tickets (T043)."),
("P18","confirmed","'How others see you' opens the own editable profile (T043)."),
("P19","confirmed","Chat messages are also notifications; one flat list (T044)."),
("P20","confirmed","Recruiter wording on landing, welcome, Privacy centre, notification settings, Billing (T001, T062, T045, T066)."),
("P21","not reproduced","With an active Pro trial the Privacy centre no longer shows the 'Names… are a Pro feature' line."),
("P22","not reproduced","Abandoned ventures don't appear on the signed CV locally (they still list first in Ventures and on the profile, R66)."),
("P23","confirmed","'Spark tier on Skilient' printed in header and summary (T084)."),
("P24","confirmed","After a share link expired, the Privacy centre still said '1 active share link' while the CV page said 'Share links are paused.'"),
("P25","confirmed","Settings > GitHub says 'Not synced yet.' while skills cite commits and repositories (T070); counts aren't reconciled."),
("P26","confirmed","Feedback attaches '/feedback', not the page you came from (T067)."),
("P27","confirmed","No way to add a claimed skill in onboarding or /me/skills (T009, T070)."),
("P28","can't check locally","Production content volume; the local run is seeded."),
("P29","can't check locally","A Raw-tier account has no issued CV locally (signing runs in a worker); Spark could make a link (T085)."),
("P30","can't check locally","Seeded posts fill every filter, so the empty copy didn't show."),
("P31","not reproduced","No horizontal overflow of venture tabs at 1280 px desktop; on phones the tabs overflow (R58)."),
("P32","confirmed","Text in px doesn't grow with the browser font size; dock labels overlap (T025, R33)."),
("P33","confirmed","Skill drawer level rules say 'they'/'their' (T069)."),
("P34","confirmed","Society page title is 'Society · Skilient'; Following and Join/Leave sit side by side with equal weight."),
("P35","can't check locally","Production society name."),
("P36","confirmed","'There is no data export at launch.' on Delete account (T064)."),
]
p='docs/ux-pilot/results.json'; r=json.load(open(p))
r['production_recheck']=[{"id":i,"result":res,"note":n} for i,res,n in R]
json.dump(r,open(p,'w'),indent=1,ensure_ascii=False)
from collections import Counter; print(Counter(x[1] for x in R))
