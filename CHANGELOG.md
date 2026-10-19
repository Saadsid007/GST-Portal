# Changelog

## 2026-10-19 — Launch release

### Accounts

- Signing up now requires the 6-digit code emailed to the address; no account opens without
  it. A returning unverified user gets a fresh code at sign-in, entered on the same screen.
- Mobile number (Indian, 10 digits) is required at signup. Not verified yet.
- Fixed a redirect loop that kept the sign-in page from opening for anyone with an expired
  session cookie.
- Sign-up and sign-in no longer wait on the email server.

### Filing

- GSTR-1 JSON is written exactly as the GST Returns Offline Tool **V3.2.4** writes it — the
  portal had been refusing files stamped with the older 3.1.6. Credit notes use the delinked
  schema, items are numbered by rate, services report UQC "NA".
- The Excel is written into the official template V2.2.
- Convert is four steps: Setup, Upload, Review, Download. Steps that need nothing from the
  user pass on their own.
- Amazon: upload B2B, B2C or both.
- Amazon B2B billed to a buyer in your state and shipped elsewhere follows the invoice's tax
  (IGST Act s.10(1)(b)).
- FBA lines without an HSN take their ASIN's code; any sale still missing one is flagged.

### Billing

- Fixed: a plan or add-on paid by UPI QR could be marked paid without being activated.
- Wallet credits: 1 credit = ₹1 off every plan, renewal and GSTIN add-on, applied
  automatically. Referral rewards pay on the referred seller's first paid plan.
- Payment screens update the moment a payment lands, without a refresh.

### Admin

- Users & plans: open any account for its email, mobile, plan, validity and last activity;
  extend or reduce validity, change plan or capacity, delete or restore the account. A
  deleted account keeps its data, and its email can sign up afresh.
- Support conversations are emailed both ways; the support inbox gets every new request.
- Campaigns: working one-click unsubscribe; audiences read live subscriptions; sending runs in
  the background with delivery counts.
- Blog posts are pinged to search engines and added to the sitemap when published.
- Removed settings that no longer affected anything (per-return pricing, recharge packs).

### Site

- Public pages are prebuilt and served static.
- New logo; a professional dark theme across every page.
