-- GradeMyCar canonical reporting queries (BigQuery, project `grademycar`, dataset `analytics_500340381`).
-- Read-only. Run each block on its own. Definitions: see ../ANALYTICS.md.
--
-- BEFORE USING: fill in the two lists below with the Firebase uids and GA pseudo ids of your own
-- devices/accounts (owner, test accounts, staff). Old events from before the internal flag existed
-- (before 2026-10-12) are untagged, so this list is the only way to exclude them.
-- Keep the real values out of this public repo: paste them into the BigQuery console, don't commit them.
DECLARE internal_uids       ARRAY<STRING> DEFAULT [];   -- e.g. ['abc123...']
DECLARE internal_pseudo_ids ARRAY<STRING> DEFAULT [];   -- e.g. ['1133150979.1788370399']
DECLARE start_suffix STRING DEFAULT '20261001';
DECLARE end_suffix   STRING DEFAULT '20261231';

-- Shared filter: real production traffic only.
CREATE TEMP FUNCTION p(ps ARRAY<STRUCT<key STRING, value STRUCT<string_value STRING, int_value INT64, float_value FLOAT64, double_value FLOAT64>>>, k STRING) AS (
  (SELECT COALESCE(value.string_value, CAST(value.int_value AS STRING), CAST(value.double_value AS STRING)) FROM UNNEST(ps) WHERE key = k)
);

CREATE TEMP TABLE clean AS
SELECT
  e.*,
  p(event_params, 'page_location') AS page_location_,
  p(event_params, 'transaction_id') AS transaction_id_,
  p(event_params, 'method') AS method_
FROM `grademycar.analytics_500340381.events_*` e
WHERE REGEXP_CONTAINS(_TABLE_SUFFIX, r'^[0-9]{8}$')          -- skips events_intraday_*
  AND _TABLE_SUFFIX BETWEEN start_suffix AND end_suffix
  AND COALESCE(p(event_params, 'internal'), 'false') != 'true'                 -- ?internal=1 devices
  AND COALESCE(p(event_params, 'traffic_type'), '') != 'internal'
  AND p(event_params, 'debug_mode') IS NULL                                    -- GA4 DebugView / ?gmc_debug=1
  AND NOT EXISTS (SELECT 1 FROM UNNEST(user_properties) up WHERE up.key = 'internal_user' AND up.value.string_value = 'true')
  AND NOT (user_id IN UNNEST(internal_uids))
  AND NOT (user_pseudo_id IN UNNEST(internal_pseudo_ids))
  AND COALESCE(traffic_source.source, '') != 'test'                            -- utm_source=test links
  AND COALESCE(p(event_params, 'page_location'), 'https://www.grademycar.com/') NOT LIKE '%localhost%'
  AND COALESCE(p(event_params, 'page_location'), 'https://www.grademycar.com/') NOT LIKE '%utm_source=test%';

-- 1) Accounts created (sign_up). One row per uid when the uid is known, else per browser.
--    This is "sign-up events from non-internal browsers". It is NOT proof of a real person:
--    reconcile against Firebase Auth (see ANALYTICS.md, "Verifying signups").
SELECT
  COUNT(DISTINCT COALESCE(user_id, user_pseudo_id)) AS accounts_created,
  COUNTIF(user_id IS NULL) AS events_without_uid_unverifiable
FROM clean
WHERE event_name = 'sign_up';

-- 1b) Same, listed, so you can match each row to an account in the Firebase console.
SELECT TIMESTAMP_MICROS(event_timestamp) AS ts, user_id, user_pseudo_id, method_ AS method, page_location_
FROM clean WHERE event_name = 'sign_up' ORDER BY ts;

-- 2) Purchases: only server-sent (Stripe webhook) events for LIVE Stripe sessions, one per transaction.
SELECT
  COUNT(DISTINCT transaction_id_) AS paid_orders,
  SUM(ecommerce.purchase_revenue) AS revenue_usd_if_populated
FROM clean
WHERE event_name = 'purchase'
  AND transaction_id_ LIKE 'cs\_live\_%';             -- excludes Stripe test-mode (cs_test_...) and malformed ids

-- 2b) Same, listed, so you can match each transaction_id to a payment in the Stripe Dashboard.
SELECT TIMESTAMP_MICROS(MIN(event_timestamp)) AS ts, transaction_id_, ANY_VALUE(user_id) AS user_id,
       COUNT(*) AS copies_in_export_should_be_1
FROM clean WHERE event_name = 'purchase' GROUP BY transaction_id_ ORDER BY ts;

-- 3) Report unlocks (credit spent or unlimited plan used). Not money. Split attempts from confirmed unlocks.
SELECT event_name, COUNT(*) AS events, COUNT(DISTINCT COALESCE(user_id, user_pseudo_id)) AS users
FROM clean WHERE event_name IN ('unlock_attempt', 'unlock_report') GROUP BY event_name;

-- 4) Checkout funnel (starts are not payments).
SELECT event_name, COUNT(*) AS events, COUNT(DISTINCT COALESCE(user_id, user_pseudo_id)) AS users
FROM clean WHERE event_name IN ('select_plan', 'begin_checkout', 'purchase') GROUP BY event_name;
