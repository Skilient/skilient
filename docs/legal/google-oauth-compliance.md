# Google OAuth privacy policy: where each requirement is met

Sources: Google Cloud, "Privacy policy requirements for OAuth apps" (support.google.com/cloud/answer/13806988) and the API Services User Data Policy, Limited Use section (developers.google.com/terms/api-services-user-data-policy). Checked 2026-10-14.

| Requirement | Where it is met |
|---|---|
| Linked on the app homepage and displayed in the app interface | Marketing footer ("Privacy notice"); signed-in sidebar footer (desktop) and Settings ("Privacy notice") for every role |
| Dedicated page, HTML body (no PDF or iframe) | `/privacy`, rendered from the published agreement text |
| Privacy policy URL differs from the homepage | `https://www.skilient.com/privacy` vs `https://www.skilient.com` |
| Hosted on a verified domain you own | `www.skilient.com` (domain verified) |
| Not a template or sample; easy to access and understand | No placeholders in the notice; plain-language sections |
| Access: what Google user data is accessed | P3 "What we access": openid, email and profile only; Google account id, email, name; no Gmail, Drive, Calendar, Contacts; no photo; no actions in the Google account |
| Use: how the data is used, limited to user-facing features | P3 "How we use it": sign-in, university email check, account name and email, sign-in codes and alerts, account recognition |
| Sharing, transfer and disclosure | P3 "Who receives it": service providers under contract (P6), legal requirement, security purposes |
| Protection | P3 "How it is protected"; P12 |
| Retention and deletion, including how users can request deletion | P3 "How long we keep it"; agreement heading 11; P8 |
| Actions taken on the user's behalf | P3 "What we access": no action in the Google account other than signing in |
| Prohibited uses: advertising, data brokers, resellers, creditworthiness, lending, databases, AI/ML training | P3 "What we never do with it" |
| AI/ML affirmation, exact wording | P3 "AI and machine learning": "Google Workspace APIs are not used to develop, improve, or train non-personalized AI and/or ML models." |
| Human access limited to permitted cases | P3 "Who can read it" (affirmative agreement, security, legal, aggregated internal operations); staff access logged; view-as notifies the user |
| Employees, agents and contractors must comply | P3 "Who receives it" |
| Limited Use statement | P3 "Limited Use" |
| Notify users and obtain consent when the use changes | Agreement heading 13; version 3 re-accept at next sign-in |

## Open items before submitting

- Consent screen, Google Cloud console: application homepage `https://www.skilient.com`; privacy policy link `https://www.skilient.com/privacy`; authorised domain `skilient.com`; scopes `openid`, `email`, `profile`.
- Transfers: the policy's transfer exceptions list user consent, security, legal compliance and mergers. Service providers that process Google user data on Skilient's behalf (P3 "Who receives it") are not named in that list. The notice states the arrangement; if the verification team asks, answer by pointing to the contracts and P6.
- After the policy URL is final, click "Prepare for verification" on the last page of the consent screen setup, then "Submit for verification".
