# Payments with Polar (polar.sh)

Premium and coins are bought through Polar's hosted checkout. The app never sees card details. The server decides what a payment is worth from the **Polar product id**, so nothing the browser sends can change the price or the reward.

Flow: app -> `POST /api/checkout` (signed-in users only) -> Polar checkout page -> payment -> Polar calls `POST /api/polar-webhook` -> the server adds Premium days / coins -> the app picks it up (it checks for a few seconds after returning to `/premium?checkout=success`).

Needs the **Account Premium and coins** flag on (Admin > Remote config), as in `docs/ADMIN.md`. Guests keep the local demo.

## Set up (do it in Polar's sandbox first)

1. **Run** `supabase/migrations/003_payments.sql` in the Supabase SQL editor (after 001 and 002). Admin > Overview shows a "Payments (Polar)" check.
2. In Polar create **one-time** products (not subscriptions):

   | Item | Product | Suggested price |
   |---|---|---|
   | Premium, 1 month (adds 30 days) | `POLAR_PRODUCT_PREMIUM_1M` | $9 |
   | Premium, 12 months (adds 365 days) | `POLAR_PRODUCT_PREMIUM_12M` | $59 |
   | 10 coins | `POLAR_PRODUCT_COINS_10` | $0.99 |
   | 50 coins | `POLAR_PRODUCT_COINS_50` | $3.99 |
   | 120 coins | `POLAR_PRODUCT_COINS_120` | $7.99 |
   | 300 coins | `POLAR_PRODUCT_COINS_300` | $14.99 |

   The prices shown in the app are fixed text in `PremiumScreen.js` and `CoinsScreen.js`: keep them equal to the prices in Polar.
3. In Polar > Settings create an **Organization Access Token** (it must be allowed to create checkouts) and add it as `POLAR_ACCESS_TOKEN`.
4. In Polar > Settings > Webhooks add the endpoint `https://app.myscoutwave.com/api/polar-webhook`, format **Raw**, subscribe to `order.paid` and `order.refunded`. Copy its secret into `POLAR_WEBHOOK_SECRET`.
5. Add the six `POLAR_PRODUCT_*` ids in Vercel. For sandbox testing also set `POLAR_SERVER=sandbox` (sandbox has its own token, products and webhook). **Redeploy** after changing environment variables.
6. Test: sign in, open Premium, pay with Polar's sandbox test card, and watch Admin > Users for the new end date. Then repeat with live credentials and remove `POLAR_SERVER`.

## Behaviour

- **Once only.** Every Polar order id is stored in `payment_events`; a repeated or retried webhook is acknowledged and ignored.
- **Premium stacks.** A second purchase extends from the current end date. A permanent (admin-granted) Premium stays permanent.
- **Refunds.** `order.refunded` takes the purchase back: coins down to zero at most, Premium days off the end date. Every coin movement is in `coin_ledger` as `purchase:<order>` / `refund:<order>`.
- **Verified.** The webhook checks the Standard Webhooks signature and rejects anything older than 5 minutes. Orders for products that aren't in the table above are ignored.
- If Polar can't reach the endpoint it retries; if granting fails the order is released so the retry can succeed.
