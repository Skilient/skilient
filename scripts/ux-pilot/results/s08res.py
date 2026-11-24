import sys; sys.path.insert(0,'scripts/ux-pilot'); from merge import *
merge(tasks=[
T("T080","Done",["Signed by Skilient and locked: 'Sealed · 05:01' with a code; the verify page says 'hasn't changed since'.",
 "Likely yes: the PDF has a code, and the public verify page shows 'Valid', the issuer, date, evidence and 'Signature: Ed25519, checked'.",
 "Yes, though 'Ed25519' and 'key cv-2026…' mean nothing to a committee; 'Issued by Skilient' for a venture completion is less convincing than a society's name."],[],"Pin: instant, the entry shows under 'From the Record' on the profile. Certificate downloaded (62 KB).",4,3),
T("T081","Done",["Expires after: 7 days / 30 days / 90 days radio, then 'Make a share link' ('expires 1 Dec 2026').",
 "Mostly: the committee view lists the entries I show; it doesn't say hidden entries are left out. 'Copy your link now: it won't be shown again.'",
 "Yes for the visitor: 'This link isn't valid. It may have expired or been revoked.' But my page still showed the revoked link with 'Copy link' (R86), and Revoke had no confirmation."],["R86"],"Transcript PDF downloaded.",6,5),
T("T082","Done",["The society: 'The society's officers see your note. If they correct it, a new entry replaces this one and this code reads superseded.'",
 "It moved under 'Corrected entries (1)'; the new one '…(2 sessions)' has a new code.",
 "'Issued in error · 24 Nov 2026: Issued to the wrong list…' with an Appeal button on the entry and on Appeals. Enough."],[],"",4,3),
T("T083","Done",["Yes: 'Your first entry is one event away.'",
 "No: it suggested 'Security talk (registration closed)', an event you can no longer register for (R87)."],["R87"],"",1,1),
T("T084","Partly done",["Yes: nothing to type; sections are switches with up/down. Good for trust.",
 "Yes: 'Spark tier on Skilient' is printed twice (header and summary) and can't be turned off (P23). The same certificate appears three times (R75).",
 "Not yet: the changes apply only from the 1 December version ('Saved. Your CV changes on 1 December.'); refreshing now is Pro."],["R88","R75"],"The section switches have no accessible names (R88). Done-when can't be met on the free plan within the session.",6,5),
T("T085","Partly done",["The PDF: 'ATS PDF export is a Student Pro feature, coming with plans.' The link worked for a Spark account.",
 "Mostly: 'Your web CV and share links are free.' But 'coming with plans' while a trial exists confuses.",
 "Privacy centre: '1 active share link', and on the CV page 'Views through your links: 0'."],[],"'Share links are paused.' appears on the CV page next to the new link without explanation.",5,4),
T("T086","Done",["Genuine: 'Your PDF matches a PDF issued under this code.' Forged (one character changed): 'doesn't match… The genuine CV is shown below so you can compare.'",
 "On /verify you must first type the code; the PDF check only appears after (R89)."],["R89"],"A transferred venture shows the new owner as 'Creator' on their CV (R90).",4,3),
],findings=[
F("R86",2,"/me/record share","After revoking a share link, the page keeps showing the revoked URL with 'Copy link'; Revoke has no confirmation.","Make a link, revoke it.","T081","H03,H04","Clear the one-time link panel on revoke; confirm the revoke."),
F("R87",2,"/me/record (empty)","The empty Record suggests an event whose registration has closed.","Open the Record with no entries.","T083","EMP","Suggest only events open for registration."),
F("R88",2,"/me/cv sections","The section show/hide switches have no accessible name.","Focus a section switch with a screen reader.","T084","ACC","Label each with the section name."),
F("R89",1,"/verify","The PDF check is only on the result page after a code; /verify doesn't say you can check a PDF.","Open /verify.","T086","H06,TRU","Offer 'Check a PDF' on /verify and read the code from the file."),
F("R90",2,"Signed CV","A venture handed to a teammate shows them as 'Creator' on their CV.","Transfer ownership, issue the new owner's CV.","T086,T055","TRU","Keep 'Creator' for the founder; show 'Owner' or 'Lead' for later owners."),
],cw=[
C("F24.10","T081",4,"The revoked link still shows with Copy link."),
C("F25.03","T084",4,"Changes don't show on the CV until 1 December."),
],plan=[
P("T084","On the free plan CV changes apply at the next monthly refresh; the done-when can't be met in a session. Use a Pro trial or accept 'saved for the next version'."),
P("T086","Setup: the genuine PDF needs Pro (trial); the forged one is a print with one character changed."),
])
