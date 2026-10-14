-- Agreement version 2: the full Skilient User Agreement and Privacy Notice (PRD 5.27).
-- Text: docs/legal/user-agreement-and-privacy-notice.md (body copied verbatim from line 3).
--
-- Staged, not published: published_at stays null, so the current version stays 1 and nobody
-- is asked to accept this text yet. Publishing is a separate step, taken only after counsel
-- review and after every bracketed placeholder in the text is filled in (a later migration
-- replaces body_md while published_at is still null). To publish:
--   update public.agreement_versions set published_at = now() where version = 2;
-- Publishing forces every account to accept again at its next sign-in.
insert into public.agreement_versions (version, title, summary_md, published_at, body_md) values (
  2,
  'Skilient User Agreement and Privacy Notice',
  'The full text of the Skilient User Agreement and Privacy Notice, replacing the headings-only launch template.',
  null,
  $agreement$
This agreement is between you and Skilient (Pvt.) Limited, registered in Pakistan at NEIC, IJP Road, I-12, Islamabad ("Skilient", "we", "us"). It applies to everyone who creates an account on Skilient, and to anyone who uses it. The Privacy Notice in the section headed "Privacy notice" below is part of this agreement.

## 1. Who we are and what Skilient is

Skilient is a platform where university students in Pakistan prove their skills through real project work. We use GitHub activity, peer and faculty verification, credentials that people upload and short code checks as evidence, and we turn that evidence into a signed CV that recruiters can check. Universities, faculty, recruiters and our staff each have their own areas of the platform.

Skilient helps students and employers find each other. We do not guarantee that any student will be hired, selected, admitted, funded or paid, and we do not make hiring decisions. Those decisions belong to the employers, universities and others you deal with.

When you create an account or use Skilient, you agree to this agreement. You agree to the Privacy Notice that forms part of it.

## 2. Eligibility

You must be at least 18 years old and able to enter a binding contract under the law of Pakistan to use Skilient.

A student account is for a person who is enrolled at, or has graduated from, a university listed on Skilient, and who signs up with an email address on that university's domain. A faculty account is for a teacher whom a listed university has approved. A recruiter account is for a person who works for a company that Skilient has verified, using a company email address. A university account is for a member of staff whom the university has authorised to act for it.

We may refuse, limit or end an account that does not meet these rules. When your enrolment or employment changes, tell us through the app. For example, when a student graduates their account changes state, as described in heading 3.

## 3. Your account

You must give accurate information, including your name, your university or company email address and any GitHub account you connect. Each person may have one account. You must not share your password, let someone else use your account, sign in as someone else, create an account for another person, or use another person's email address or GitHub account.

You are responsible for everything that happens on your account. Keep your password and two-factor codes secret. If you think someone else has access to your account, tell us at security@skilient.com straight away and change your password. Two-factor sign-in is required for recruiter, university and staff accounts and optional for students and faculty.

Graduates. When your university's final-year batch rolls over, your student account becomes a graduate account. You keep your profile, CV, skills, evidence, chat, friends and recruiter visibility, and you can apply for jobs. You can no longer post in your university's feed or join university-only ventures. You lose sponsored Pro, but you can buy Pro again. You drop off your university's leaderboards 12 months after you graduate.

Changing your university email address needs a new verification. A student account stays tied to one university email address at a time.

## 4. Your content and our licence to display it

You keep ownership of what you post, upload or send on Skilient, including posts, comments, messages, project descriptions, images, credential files, reports and feedback ("your content"). Other people may see your content according to the controls in the app and the rules in this agreement.

You give Skilient a non-exclusive, royalty-free, worldwide licence to host, store, copy, display, resize and otherwise process your content, and to create CV exports and previews from it. You give this licence only so that we can run the platform and show your content to the people you choose or the rules allow. The licence ends when your content is deleted or your account is deleted, except for copies held in backups and logs for the periods set out in the Privacy notice, and for copies that other people have already made lawfully.

You must have the right to post what you post. Do not post content that infringes someone else's rights, is unlawful, defamatory, threatening, harassing, sexually explicit, hateful, or that discloses another person's private information without their consent. We may remove content, and we may give information to authorities, where the law requires it, including under the Prevention of Electronic Crimes Act 2016.

## 5. Verification and evidence

Skilient builds your skill record from evidence. Evidence can include commits and merged pull requests in repositories you connect, endorsements from other people, reviews by faculty or venture supervisors, credential documents that you upload and the results of short code checks. Skill levels, rank and tiers are computed under rules that we publish in the app. Changes to those rules are covered by heading 13.

When you connect GitHub, you allow the Skilient GitHub App to read repository contents, repository metadata and pull requests on the repositories where the App is installed, and you allow us to use your GitHub account details to identify your activity. The App has read-only access; Skilient cannot write to your repositories. We keep an evidence record of identifiers, dates, file and line counts, repository names and visibility, and the skill signals we derive from them. We do not store your source code or the text of your commit messages. You can disconnect GitHub at any time in Settings. Evidence we have already recorded stays on your account until you delete it, but syncing stops.

Other people's views are part of the evidence. Endorsements, reviews and confirmations come from people who have their own judgement and their own interests. We may hide, discount, freeze or remove evidence that looks copied, fabricated, traded or produced to game the ranking, and we may recompute your record when we do. Faculty and university staff may review or confirm work that they supervise. They must be honest, must declare any conflict of interest and must not confirm work they did not supervise.

A verified CV is signed by Skilient and shows the evidence it was issued with. Anyone who has the CV link or code can check it at the verification page. You can create, revoke and reissue CV share links. A revoked CV shows only its code and dates on the verification page.

Skilient does not guarantee employment, an internship, admission, a scholarship, a grade or any other outcome from your skill record or your rank.

## 6. University records

Universities that hold a current licence with the right feature on Skilient (at present, the Growth and Campus plans) can see an individual record for each of their own students. A record shows the student's profile, skills, evidence levels and the activity on Skilient that the plan covers. Only a university's admins and the coordinator for the student's department can open a record, and every time someone opens a record it is logged. A university cannot see your chats, your recruiter activity or who has viewed your CV.

You cannot opt out of this access while you are a student at that university. This is a condition of using Skilient as a student, and it is covered by this agreement. If you hold Student Pro, you can see in Settings → Privacy who at your university has opened your record and when. A university must use student records only for its academic and placement programmes, must not sell them, and must not pass them to anyone who is not entitled to see them, except where the law requires. Universities do not see raw analytics events, session recordings or heatmaps.

## 7. Recruiter visibility and your controls

Recruiter visibility is off until you turn it on. When it is on, verified recruiters can find you by the skills, levels and details you choose to show, and can send you contact requests within the limits of their plan. A recruiter who only browses sees anonymised results with no name, photograph, username or link. A recruiter sees your name and full profile only on a plan that allows it, and only after you accept a contact request or your settings allow it.

You can turn recruiter visibility off at any time. The change applies to searches within 24 hours. A shortlist entry that a recruiter made before you turned visibility off stays on their list, marked as no longer visible, and they cannot open your profile from it. You can decline any contact request, block any company so that none of its members can see or contact you, report any recruiter, and see which companies viewed your profile (with names on Student Pro and as counts otherwise) and every company that has contacted you.

A recruiter may use your information only to recruit you for work or an internship. A recruiter must not use it for any other purpose, including selling services to you, must not scrape, copy or export information from Skilient except as the product allows, and must not contact you through any other channel that you have not given them. When a recruiter hires you through Skilient, the recruiting company pays the hiring fee. You do not pay it.

## 8. Acceptable use and anti-gaming

You must not create fake accounts or fake work, claim work you did not do, or present someone else's work as yours. You must not buy, sell, trade or ask for endorsements, reviews, confirmations, ranking, skill levels or visibility. You must not organise accounts to endorse or review each other. You must not use bots, scrapers or automated tools to read profiles, search results or feeds, or to take actions on Skilient. You must not try to get into systems, accounts or data that are not yours. You must not harass, threaten or stalk anyone, send spam or unsolicited commercial messages, post malware or links designed to harm people, or share answers to a code check or use someone else to sit one.

Where Skilient recognises work as AI-assisted, we label it as such on your profile and CV. Hiding or misdescribing AI assistance where your university, teacher or venture requires it to be disclosed breaks this agreement.

If you break these rules, we may hide content, remove evidence, adjust your ranking, apply a penalty, or take the action set out in heading 10.

## 9. Paid plans, billing and refunds

Some features are paid. Students can buy Student Pro. Recruiters, universities and some other organisations buy plans, and some features are sold as add-ons, such as sponsored posts and credits. Prices, features and limits are shown before you pay. We may change prices with at least 30 days' notice. A price change does not affect a period you have already paid for; it applies when that period renews.

No payment buys a higher rank, a higher skill level, a better search position, a place on a leaderboard or a better standing in the feed. Sponsored posts are labelled as sponsored and do not change anyone's rank, skill level or leaderboard position.

Payments in Pakistani rupees go through Safepay, our payment gateway. Payments in US dollars go through Paddle, which is the merchant of record for those payments: Paddle takes the payment, issues the receipt and handles the billing relationship for them, and Paddle's terms apply to them. We do not receive or store your full card number. Our invoices show our legal details and, where it applies, sales tax.

Paid plans renew for the period you chose unless you cancel. You can cancel at any time in Settings → Billing, or on the billing page for your organisation or university. Cancelling stops the next renewal. The paid features end when the period you have paid for ends.

Fees for a period are not refunded once the period has started, except that: (a) if we charged you twice or charged you in error, we refund the extra amount in full; (b) if we did not provide a paid feature for reasons within our control, we refund the part of the period that you did not receive; and (c) we refund where the law requires. A refund for a payment made through Paddle follows Paddle's refund policy.

A recruiting company may dispute a hiring fee within 14 days of the invoice. We decide the dispute under the rules in our billing settings. A company with a hiring fee unpaid after 30 days cannot send new contact requests until it is paid.

## 10. Moderation, suspension and appeals

Anyone can report a post, comment, message, profile, venture, company or university through the app. Our staff review reports and may hide or remove content, warn someone, limit an account (for example by throttling contact requests), suspend an account or organisation, ban it, or take other action under this agreement. A moderator may suspend an account for no more than seven days. Bans for serious breaches are decided only by our most senior staff. We do not tell a reporter what action we took, but we confirm that we received the report.

When we take action against you, we tell you what we decided and, where we can, why. You can appeal most decisions from the Appeals page in the app, within the time shown there. A member of staff who did not make the original decision decides the appeal.

We may remove content or disclose information where a court, a competent authority or the law requires it, including under the Prevention of Electronic Crimes Act 2016. Where the law allows, we tell you before we disclose your information.

## 11. Account deletion and data retention

You can delete your account at any time in Settings → Account → Delete account. To confirm, you must type your username. Deletion has a 14-day cooling-off period. While it runs, your account can reach only the deletion page, and you can cancel the request to restore your account. Cancelling a deletion does not change a graduate account back into a student account.

When the 14 days end, we delete your account in an automated process. A venture you own passes to the longest-standing other member of that venture. A venture with no other member is deleted. Your posts, messages, endorsements you have given, credentials, notifications and personal details are removed. Your images are removed from our storage. Your sign-in account is then deleted. A staff account cannot start its own deletion; a super admin must remove its staff roles first.

Some information is kept. We keep invoices and payment records for as long as Pakistani tax and company law requires. We keep reports and sanction records for as long as needed to enforce a ban, decide an appeal or defend a legal claim. Hire records and organisation notes stay in the recruiter's records with the personal details removed; the text of a note is deleted. A revoked CV keeps its code and dates so that the verification page can show that it was revoked, but its content is removed. Database backups keep copies of data for a limited period and then overwrite them, as the Privacy notice describes.

Copies that other people have already made before your account was deleted, such as a CV PDF they downloaded, are outside our control.

Deletion is final once it completes. We cannot restore a deleted account or its content. The Privacy notice describes how long each kind of data is kept.

## 12. Liability and disclaimers

Skilient is provided as it is and as it is available. To the extent the law allows, we make no promise that the platform will always be available or error-free, that it will fit a particular purpose, or that content posted by other people is accurate. We are not responsible for employment, admission, grading, teaching or other decisions made by employers, universities, teachers or other users, or for what users say to each other.

To the extent the law allows, our total liability to you for all claims relating to Skilient is limited to the fees you paid us in the 12 months before the event that gave rise to the claim. We are not liable for indirect or consequential loss, lost opportunities or lost profits. Nothing in this agreement limits liability for fraud, for death or personal injury caused by negligence, or for anything else that the law does not allow us to limit.

You are responsible for your content and for your breaches of this agreement. To the extent the law allows, you will compensate us for losses that a claim against us causes because of them.

## 13. Changes to this agreement

We may change this agreement or the Privacy Notice. For material changes, we give at least 30 days' notice in the app and by email. You must accept the new version when you next sign in before you can use Skilient. The app shows a short summary of what changed. If you do not accept the new version, you can delete your account under heading 11.

We may change how evidence, skill levels, rank or tiers are scored. We publish each change in the app with its effective date, and it applies from that date. We will not change a rule so that it applies to a CV that has already been issued without telling the owner of that CV.

## 14. Governing law, disputes and contact

This agreement is governed by the law of Pakistan. The courts in the city where our registered office is located have jurisdiction over any dispute that we cannot settle between us. Before starting proceedings, please contact us, so that we can try to resolve the dispute. If any part of this agreement is found unenforceable, the rest stays in force. This agreement, the Privacy Notice and the rules published in the app together form the whole agreement between you and Skilient about the platform.

Contact us at Skilient (Pvt.) Limited, NEIC, IJP Road, I-12, Islamabad. For privacy requests, email security@skilient.com with the subject "Privacy request", or write to us at the address above. For security reports, write to security@skilient.com.

## Privacy notice

## P1. Who we are and what this notice covers

This notice explains what personal data Skilient (Pvt.) Limited collects through Skilient, why we collect it, who we share it with, how long we keep it and what you can do about it. It covers students, graduates, faculty, recruiters, university staff, people who visit our public pages and people who contact us.

This notice applies to the Skilient website and web application at www.skilient.com. We are responsible for the personal data described in this notice. When a university or a company uses Skilient to manage its own records or people, it is responsible for what it does with the information it sees. This notice describes what it can see and the rules it must follow, which are set out in the user agreement.

## P2. What we collect

Account and sign-in. Your name, your university or company email address, and your password. Passwords are stored in hashed form, never as plain text. If you use two-factor sign-in, we store your authenticator setup and recovery codes in protected form. If you sign in with Google, we receive your Google account identifier, your verified email address and your name.

Profile. Your photograph, headline, about text, skills, department, programme, batch, city and any links you add.

University status. Your university, department, programme, batch and whether you are a current student or a graduate. We confirm your university from your email address and the university's records.

GitHub. Your GitHub login and numeric account identifier, the repositories you connect (their names, visibility and ownership), commit identifiers and dates, file and line counts, merged pull requests, reviews and approvals that count as evidence, and whether your connection has been revoked. We do not collect your source code or the text of your commit messages.

Activity on Skilient. Your ventures and project updates, posts, comments, polls, events you join or host, applications, messages, friends and blocks, endorsements you give and receive, reports and feedback you write, the answers you give to short surveys, and views of posts, which we count per viewer to rank content.

Credentials and documents. Certificates, letters or transcripts that you upload to support a credential, and the outcome of our review. These are stored privately, and only you and our reviewers can open them.

CV. The signed snapshot of your skills and evidence, your CV settings, your share links, and records of who has viewed your CV and when.

Payments. Your plan, invoice details (including the name and address you give for an invoice), transaction references and amounts from our payment gateways. We do not receive or store your full card number.

Technical data. Your IP address, which we use for security and rate limits and store as a hash wherever we can, your browser and device details, timestamps, error reports and request identifiers in logs. We use cookies that keep you signed in and protect your account. We do not use advertising cookies or cross-site tracking. Analytics, session recordings and performance measurements are described in P7.

Code checks. Where a code check's snippet sits in one of your repositories, your answers to the check, and the outcome of the review. We store the location of the snippet, not the code itself.

## P3. Google user data

This section covers the information we receive from Google when you sign in with Google. We call it Google user data.

What we access. When you choose to sign in with Google, we ask Google only for the openid, email and profile permissions. From Google we receive your Google account identifier, the email address on the account and your name. We do not request access to your Gmail, Google Drive, Google Calendar, contacts or any other Google service, and we do not copy your Google profile photo.

How we use it. We use Google user data only to provide or improve user-facing features of Skilient: to sign you in, to confirm that your university email address belongs to a listed university, and to show your name and email address in your account. We do not use Google user data for any other purpose.

What we never do with it. We do not use Google user data for targeted, personalised, retargeted, interest-based or other advertising. We do not sell it, and we do not transfer it to data brokers or information resellers. We do not use it to determine creditworthiness or for lending. We do not use it to build any database other than your Skilient account. We do not use it to develop, improve or train any AI or machine-learning model, whether personalised or not. Skilient does not send Google user data to any AI or language-model service, and Skilient does not use Google Workspace APIs to develop, improve or train non-personalised AI or machine-learning models.

Who receives it. We share Google user data only with the service providers listed in P6, and only as far as they need it to run Skilient for you. We also disclose it where the law requires. Your name and your university email address may be shown to universities and recruiters only as described in headings 6 and 7 of the user agreement and in your settings. Your university email address is shown to others only if you choose to show it.

How it is protected. Google user data is encrypted in transit and at rest. It is protected by the same row-level security and access controls as the rest of your personal data, as described in P12.

How long we keep it, and how to delete it. We keep Google user data for as long as your account is active. When you delete your account, we delete it as heading 11 of the user agreement describes. You can start deletion at any time in Settings, or ask us to delete your data by contacting us as described in P14.

Revoking access. You can stop Skilient's access to your Google account at any time at https://myaccount.google.com/permissions. Revoking access stops Google sign-in, but it does not delete your Skilient account. If you signed up only with Google, you can set a password using the password reset page and then sign in with your email address.

Limited Use. Skilient's use of information received from Google APIs adheres to the Google API Services User Data Policy, including its Limited Use requirements.

## P4. Why we use your data

We use personal data to provide Skilient to you and run your account, which is necessary to perform the user agreement. We use it to verify identities and evidence, because the service depends on evidence being real and because we have a legitimate interest in stopping fake evidence. We use it to show your profile, skills and activity to the people and organisations that your settings and the rules allow, as described in the user agreement. We use it to send you notifications you have chosen, and security and account emails that the service needs. We use it to keep the platform safe, prevent fraud and enforce the rules, which is a legitimate interest and, where the law requires it, a legal obligation. We use it to take payments and keep tax records, which is necessary to perform our agreement with you and to comply with the law. We use analytics and error reports to understand how the platform works and to fix problems, using masked or aggregated data wherever we can.

Some features depend on your choice. We ask for your choice in the app when a feature needs it, for example before recruiter visibility is turned on or before a recruiter can see your full profile, and you can change the choice in Settings. A university's access to student records is not optional while you are a student there. It is part of the user agreement you accept at sign-up, as heading 6 of the agreement explains, and every access is logged.

We do not sell personal data, and we do not use it for third-party advertising.

## P5. Who can see your information

Other students and graduates see what your profile and your privacy settings allow. Your posts are visible to the audiences set for them. Profiles are visible only to signed-in users. Skilient has no public profile pages, and our search engine indexing excludes signed-in pages.

Recruiters see what is described in heading 7 of the agreement. Universities see what is described in heading 6. Faculty see the work of the ventures they supervise or review.

Skilient staff can see your personal data only for a reason, such as support, safety, responding to a report, a legal request or a billing question. Staff need two-factor sign-in, and every time a staff member opens your data it is logged. A staff member can view your account as you only with a recorded reason, and you receive an in-app notice when it happens. Staff cannot act as you.

The public verification page shows a CV's code, status and dates. If a CV has been revoked, it shows only the code and dates. It does not show the rest of the CV.

## P6. Who we share your data with

We use service providers (processors) who handle data for us under contract, only to run the parts of Skilient that they provide. They are:

Supabase, which provides our database, sign-in service and file storage. Supabase is hosted in Mumbai, India.

Vercel, which runs our web application and server functions. Our server functions run in Mumbai.

Brevo, which sends the emails we send you, such as sign-in codes, security alerts and notifications. Brevo reports back to us whether those emails were delivered or bounced.

Cloudflare Turnstile, which checks for automated sign-ups and sign-ins.

Sentry, which receives error reports. We remove personal data from those reports before they leave our systems, as far as we can.

PostHog, which provides product analytics and session recordings in its EU region, as described in P7.

Axiom, which holds our application logs for 30 days.

Safepay, our payment gateway for payments in Pakistani rupees.

Paddle, our payment processor and merchant of record for payments in US dollars.

GitHub, which is the source of the evidence you connect. Our GitHub App sends requests to GitHub on your behalf, within the access you have given.

Have I Been Pwned, which checks new passwords against breached-password lists. It receives only the first five characters of a hash of the password, never the password itself.

Google, if you choose to sign in with Google.

We also share information when the law requires it, such as with a court or a competent authority. Before we do, we tell you unless the law prevents us from doing so.

Some of these providers store or access data outside Pakistan. P11 describes where data is held.

## P7. Analytics, session recordings and error monitoring

We measure how Skilient is used, so we can find and fix problems and decide what to build next. Our analytics record named events that we have chosen, such as signing up, finishing onboarding, connecting GitHub or sending a message. They are sent to PostHog in its EU region. In PostHog we identify you only by your internal Skilient identifier. We never send names, email addresses, usernames or the content of posts, comments or messages to analytics.

For a sample of sessions (about one in five), we record the screen so that we can see where people get stuck. All form inputs are masked. So is the text of posts, comments, chat messages, CV content, profile about text, and the feed survey, and images in posts and chat are not recorded. We never record chat pages, billing pages, staff pages, sign-in, sign-up or password-reset pages. Recordings are kept for about 30 days and only Skilient staff can view them. We never share them with universities or recruiters.

For a sample of page loads, we measure page speed. We keep those measurements for 14 days. Error reports go to Sentry and application logs go to Axiom, both without personal data where we can manage it, as described in P6 and P8.

## P8. How long we keep your data

Your account data is kept while your account is active. When you delete your account, it is removed as heading 11 of the user agreement describes. Invoices and payment records are kept for as long as Pakistani tax and company law requires. Staff action logs, which record who did what to sensitive records, are kept for one year so that we can account for those actions. Reports and sanction records are kept for as long as needed to enforce a ban, decide an appeal or defend a legal claim, and are then deleted or anonymised. Images that are no longer used are removed soon after they stop being used.

Security events are kept for one year. Application logs are kept for 30 days. Analytics events are kept for 13 months. Session recordings are kept for about 30 days. Performance measurements are kept for 14 days. Database backups are kept for seven days and then overwritten. A backup that still holds data you have deleted will be overwritten within that period, and until then it is not used for any purpose except restoring the platform after a serious failure.

## P9. Your rights and choices

Inside the app you can edit your profile; choose what others see; turn recruiter visibility on or off; opt out of the leaderboard; see who has viewed you; block people and companies; choose which notifications you receive and whether emails are instant or sent as a daily digest; revoke your CV links and CVs; disconnect GitHub; and delete your account under heading 11 of the user agreement.

You can also ask us, in writing, to tell you what personal data we hold about you, to correct it, to delete it (subject to heading 11 and P8), to restrict how we use it while we check a complaint, or to stop using a choice you have given us. We do not yet offer a self-service download of all your data, so please ask us instead, and we will provide a copy of the personal data we hold about you within 30 days. We may need to check your identity before we act. If you withdraw a choice you gave us, we will stop relying on it from that point, but this does not undo anything we did before. Withdrawing a choice may mean that some features stop working.

If you think we have handled your personal data wrongly, please contact us first so that we can put it right. If the law gives you a right to complain to a regulator, you can also do that.

## P10. Children and eligibility

Skilient is for adults aged 18 and over. We do not knowingly collect personal data from anyone under 18. If we find that an account belongs to someone under 18, we will delete it.

## P11. Where your data is stored and transferred

Our main database and file storage are hosted in Mumbai, India, and our server functions run in Mumbai. Some of our service providers, listed in P6, store or access personal data outside Pakistan, including in the European Union for analytics. Before we transfer personal data to a provider, we make sure that its contract requires it to protect the data, and we send only the data the service needs.

## P12. How we protect your data

We protect your data with encrypted connections (TLS) for everything, encryption at rest through our database provider, and row-level security on every table, so that no one can read another person's data unless the rules allow it. Two-factor sign-in is required for staff, recruiters and university admins. Passwords are checked against breached-password lists, using only a partial hash. We limit the rate of sign-ins and other actions. Private files are served only through links that expire after five minutes. We remove location and camera data from images that you upload. We log staff access to personal data.

No system is perfectly secure. If we discover a breach that affects your personal data, we will tell you and the authorities that the law requires, without undue delay. If you find a security problem, please write to security@skilient.com.

## P13. Changes to this notice

We update this notice when our practices change. Material changes follow heading 13 of the user agreement, so you will be asked to accept them before you use Skilient again. Each version shows its date, so you can see when it changed.

## P14. Contact us

You can reach us at Skilient (Pvt.) Limited, NEIC, IJP Road, I-12, Islamabad. For privacy requests, email security@skilient.com with the subject "Privacy request", or write to us at the address above. For security reports, write to security@skilient.com.
$agreement$
);
