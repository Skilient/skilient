import sys; sys.path.insert(0,'scripts/ux-pilot'); from merge import *
merge(tasks=[
T("T092","Done",["Yes: a PDF letter or a link to the society on the university site. In real life the faculty advisor's letter.",
 "The proof step (reading what counts as proof). The whole request took ~9 s and 9 actions.",
 "'Request sent. Skilient reviews requests within 3 working days. We'll notify you either way.' A second request: 'You already have a request waiting… One request at a time.'"],["R97"],"Existing name: 'UX Pilot Debating Society is already on Skilient at NUTECH.' under the field and Continue did nothing else. A PDF picked as the optional logo was accepted until after submit: 'Your request is in, but the logo didn't upload' (R97). The name field has no accessible name (R88-type).",9,7),
T("T093","Done",["Yes: 'Skilient needs more information: Please add the link to your society's page… Answer and send it back' with new proof and link fields.",
 "Yes: the society page shows 'Set up your society' with four steps.",
 "Rejection (officer-1): 'Not approved · Note from Skilient: We couldn't find this society on NUTECH's list. Ask your advisor for a letter and request again.' Fair."],["R98"],"No notification arrived for 'more information' or the decision (R98); the status shows on Societies > Your requests.",3,3),
T("T104","Done",["Yes: 'Set up your society' lists logo and cover, officers, how members join, first event, each linking to its section, and ticks them off.",
 "No: the term dates default to today and a year from today, not the academic year; 'start and end month' are full dates (R99).",
 "By request; the select describes each mode in one line ('Open: Anyone… joins with one tap', 'By request: … an officer accepts', 'Inductions only'). The trade-off isn't explained."],["R99"],"Invite needed a title ('Give the role a title.'); the toast after inviting said only 'Saved.'.",9,7),
T("T105","Done",["A 'Post as' select in the composer (Yourself / each society I run).","I didn't preview; the feed shows '[UX test] Film Society · by Iqra Secretary'."],[],"",3,3),
T("T106","Done",["Yes: 'A change takes effect only when a second officer confirms it.'","Yes: 'Waiting for a second officer… Another officer confirms it.' and 'No confirmed account yet. Paid ticket types can't be published until one is confirmed.'","(Co-officer) The number and title against the society's real JazzCash account; the page shows Confirm / Reject and the proposer."],[],"",4,4),
T("T107","Done",["Yes: 'A confirmed term becomes an Office bearer entry on the officer's Record.'",
 "No: 'Offer the handover' sent it at once, no dialog; only the line 'you stay a member, and your term ends that day' (R100).",
 "From my Record ('Office bearer: President'); no notification. Only the next President could confirm my term, after I'd lost access."],["R100"],"Term dates had to be set on the local DB to stand in for the end of term. Ali's ended General Secretary term still shows 'Current'.",5,4),
T("T108","Done",["Roles and seats were clear ('Designer 2/2 open · Writer 1/1 open').","The round page after saving shows what students see.","No: nothing says who is told when publishing (followers? members?)."],[],"Two months: 'The deadline is within the next 30 days.' under the field. Saved as a draft first, then 'Publish the round' (no confirmation).",10,9),
T("T109","Partly done",["Yes: each application shows name, role, the answer and Shortlist / Accept / Decline.",
 "No: Decline is instant with no note field, so I couldn't add a kind note (R101); the applicant later sees 'Not this time'.",
 "It stays 'Applied'; the round says undecided ones are declined 14 days after the deadline."],["R101"],"Shortlisting gives no visible state once another decision is made.",4,3),
],findings=[
F("R97",2,"/societies/new","The optional logo accepts any file and fails only after the request is sent ('the logo didn't upload').","Pick a PDF as the logo.","T092","H05,H09","Check type on choosing."),
F("R98",2,"/notifications","No notification for 'more information needed', approval or rejection of a society request.","Staff decide a request.","T093","H01","Notify the requester of each decision."),
F("R99",1,"/societies/[slug]/manage officers","Term dates default to today and one year on, not the academic year.","Invite an officer.","T104","H06","Default to the university's academic year (Sept–June)."),
F("R100",2,"/societies/[slug]/manage handover","Offering the presidency hands it over (once accepted) with no confirmation; the outgoing president loses the manage page and can't confirm their own term.","Offer the handover.","T107","H05,H03","Confirm with what you lose; confirm your officers' terms first."),
F("R101",2,"/societies/[slug]/inductions/[id]","Decline is instant with no note; Accept has no confirm; the shortlist state isn't kept visible.","Decline an applicant.","T109","COP,H03","Optional kind note on decline; confirm both."),
],cw=[
C("F31.10","T107",4,"Nothing confirms the handover or what it ends."),
C("F33.05","T109",2,"No place to write a note when declining."),
],plan=[
P("T107","'Confirm your officers' terms, then hand over' isn't possible in that order: terms end at handover and the next President confirms them; reword."),
P("T104","'This academic year' needs a Sept–June default; tell testers to type the dates."),
])
