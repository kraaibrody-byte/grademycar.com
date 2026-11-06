# GradeMyCar analytics: event definitions and sources of truth

Firebase Analytics (GA4 web property `G-TT0RZ0WFN0`) exports daily to BigQuery
`grademycar.analytics_500340381.events_YYYYMMDD`. Analytics events are **evidence of behavior, not
accounting records**. For anything that counts people or money, the source of truth is the system
that actually did the thing: Firebase Authentication for accounts, Stripe for payments.

## Canonical events

| Event | Means | Fires when | Source of truth |
|---|---|---|---|
| `sign_up` | **An account was created** | Once per uid, right after Firebase Auth confirms a brand-new user (`isNewUser`). Email+password: `createUserWithEmailAndPassword` resolved. Google/Apple/email link: `additionalUserInfo.isNewUser`. Guarded per uid in the browser (`gmc_su_<uid>`). | Firebase Auth user list |
| `login` | An existing account signed in | Same sign-in code paths, when `isNewUser` is false | Firebase Auth sign-in times |
| `purchase` | **Money was collected** | Only the Stripe webhook (server, Measurement Protocol) sends it, from a paid `checkout.session.completed`. `transaction_id` = Stripe session id (`cs_live_...`), plus value and currency. Never fired from a browser. | Stripe Dashboard (live mode) |
| `unlock_report` | The server accepted an unlock: **a credit was spent, or an unlimited plan covered it** (`credit_spent` param tells which) | After the `useReportCredit` Cloud Function succeeds. Not a payment. It does not prove the report finished rendering. | `useReportCredit` / `users/<uid>/reportCredits` in Realtime Database |

## Funnel and attempt events (never count these as outcomes)

| Event | Means |
|---|---|
| `signup_prompt_shown`, `signup_field_focus`, `signup_prompt_click`, `signup_prompt_dismissed` | The user saw or touched the signup UI |
| `signup_started` | They chose to **create** an account (signup mode only) |
| `auth_attempt` (was `signup_submitted`) | They pressed submit on **sign-in or sign-up**. Param `mode` = `signup`, `signin`, `signin_link`. Includes logins and failures, so it is not a signup count |
| `signup_link_opened` | They opened the emailed sign-in link (the account may or may not be new) |
| `signup_error` | Auth rejected the attempt (`error_code`) |
| `unlock_attempt` | They tapped Unlock. Fires before the server answers, including when they have no credits (`out_of_credits` follows) |
| `select_plan`, `begin_checkout` | They picked a plan / were sent to Stripe Checkout. Not a payment |
| `purchase_returned` | The browser came back from Stripe to the app. Not a payment, can be reloaded |

Removed: `signup_completed` (it was always a second copy of `sign_up`; both fired on the same line).
Renamed: `signup_submitted` -> `auth_attempt`. Old rows keep their old names in BigQuery.

## Internal and test traffic

| Situation | What happens |
|---|---|
| `localhost`, `*.localhost`, `*.test`, file:// | No analytics sent (console only) |
| Any host other than `grademycar.com` / `www.grademycar.com` (previews, staging, `*.web.app`, `*.firebaseapp.com`) | No analytics sent (console only) |
| Browser flagged `?gmc_test=1` | No analytics sent. `?gmc_test=0` undoes it |
| Browser flagged `?internal=1` | Events are sent but carry `internal=true`, `traffic_type=internal`, and user property `internal_user=true`. Filter these out in reports. `?internal=0` undoes it |
| `?gmc_debug=1` | Events go to GA4 DebugView with `debug_mode`; reports filter them out |
| Checkout started from an internal browser | `internal` rides in the Stripe session so the webhook can tag `purchase` |
| Stripe test mode | Test sessions are `cs_test_...`. The reporting SQL counts only `cs_live_...` |

Limits: the flags are per browser (clearing site data removes `?internal=1`), and events from before
2026-10-12 were never tagged. `analytics/queries.sql` therefore also takes lists of internal uids and
pseudo ids that you fill in by hand.

## Reporting

Use `analytics/queries.sql`. It excludes internal, test, debug, localhost and non-live-Stripe rows,
and counts purchases once per `transaction_id`. Historical rows in BigQuery are untouched; the query
filters them at read time.

## Verifying signups (Firebase Auth)

1. `firebase auth:export users.json --format=json --project grademycar`
   (or Firebase console -> Authentication -> Users).
2. Each user has `localId` (the uid), `createdAt` (ms) and `providerUserInfo`.
3. Run query 1b in `analytics/queries.sql`. Every `sign_up` row with a `user_id` should match a
   `localId` whose `createdAt` is within a minute of the event time. Rows with no `user_id`
   (all sign-ups before 2026-10-17) cannot be matched by id: match by date and sign-in method.
4. Accounts in the list that are yours or test accounts do not count as customers.
   Real signups = Auth users minus those.

## Verifying purchases (Stripe)

1. Stripe Dashboard, **live mode** -> Payments, filter Status = Succeeded. Or
   `stripe checkout sessions list --live --limit 100`.
2. Each succeeded payment's Checkout Session id should appear once as `transaction_id` in query 2b,
   with matching value and currency. A `transaction_id` with no Stripe payment, or a payment with no
   event, is a discrepancy to investigate.
3. Payments from your own card are still real revenue in Stripe; refund them if they were tests.

## Not in this repo (cannot be verified from here)

The Cloud Functions (`verifyPurchase`, the Stripe webhook, `useReportCredit`,
`createCheckout*`) are not in this repository. Before relying on `purchase`, confirm in that code that
the webhook (a) checks the Stripe signature, (b) sends only for `payment_status == "paid"`,
(c) ignores `livemode == false` events or labels them, (d) uses the Stripe session id as
`transaction_id`, (e) is safe to retry (Stripe re-delivers events; GA4 reports dedupe on
`transaction_id`, but the BigQuery export does not, so ideally keep a "already reported" marker per
session id), and (f) sets `internal` from your own account list on the server, not only from the
browser flag.
