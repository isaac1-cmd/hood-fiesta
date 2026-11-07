# Hood Fiesta – website + Paystack payments + confirmation emails

```
public/index.html         the website (countdown, competitions, registration forms)
public/confirmation.html  page Paystack sends people back to after paying
api/initialize.js         creates the Paystack payment (amount is set on the server)
api/webhook.js            Paystack tells us "paid" -> sends confirmation email + reference number
api/verify.js             confirmation page uses it to show payment status
api/_lib.js               fees, validation, email templates
```

## 1. Deploy on Vercel
1. Put this folder on GitHub (or run `npx vercel` inside it).
2. On vercel.com: **Add New > Project**, import the repo, leave all build settings as they are, click **Deploy**.

## 2. Add Environment Variables
Vercel project > **Settings > Environment Variables** (see `.env.example`):

| Name | Value |
|---|---|
| `PAYSTACK_SECRET_KEY` | Paystack Dashboard > Settings > API Keys & Webhooks (`sk_test_…` to test, `sk_live_…` to go live) |
| `GMAIL_USER` | blakmixedentertainment@gmail.com (the Gmail that sends the emails) |
| `GMAIL_APP_PASSWORD` | Google App Password (step 3) |
| `ADMIN_EMAIL` | where you receive every paid registration with full details |
| `SITE_URL` | optional, your final domain e.g. `https://hoodfiesta.com` |

After adding or changing variables, **redeploy** (Deployments > ⋯ > Redeploy).

## 3. Gmail App Password
Google Account > Security > turn on **2-Step Verification** > search **App passwords** > create one named "Hood Fiesta" > paste the 16 characters as `GMAIL_APP_PASSWORD`.

## 4. Paystack webhook (this is what triggers the emails)
Paystack Dashboard > Settings > API Keys & Webhooks > set **Webhook URL** to:

`https://YOUR-SITE.vercel.app/api/webhook`

(Test and Live modes each have their own webhook URL and keys – set both.)

## 5. Test before going live
Use the `sk_test_` key and Paystack test card `4084 0840 8408 4081`, any future expiry, CVV `408`, OTP `123456`. After paying you should see the confirmation page, and the participant + admin emails should arrive. Then switch to `sk_live_` and redeploy.

## How it works
1. Person fills the form -> `/api/initialize` validates it, creates a unique reference like `HF-FB-3FA91C0D`, starts the Paystack payment and redirects them to pay.
2. Paystack calls `/api/webhook` once payment succeeds. The signature and amount are checked, then the participant gets the confirmation email with their reference number, and you get a copy with all details.
3. The person lands on `/confirmation` showing the same reference number.

## Things to know
- **No database:** registration details are stored on the Paystack transaction (Dashboard > Transactions) and in your admin emails. If you want a dashboard/list later, add a database (Vercel Postgres/Supabase) in `api/webhook.js`.
- **Fees** are in `api/_lib.js` (server) and `COMP` in `public/index.html` (display). Change both. Snooker/table tennis are set at ₦5,000.
- Gmail sends ~500 emails/day, plenty for this event.
- Paystack fees are deducted from your settlement.

## Running it on your computer first (VS Code)
1. Unzip the folder (don't open files from inside the zip), then in VS Code: **File > Open Folder** and choose `hood-fiesta`.
2. Open the terminal in VS Code and run: `npm install` then `npm i -g vercel`.
3. Copy `.env.example` to a new file called `.env.local` and fill in your Paystack **test** key and Gmail details.
4. Run `vercel dev`. Sign in and accept the prompts (link to a new project; leave settings as default).
5. Open **http://localhost:3000** in your browser – the site, forms and `/api` all work together.

Locally, Paystack cannot call your webhook (it can't reach your laptop), so the payment page works but the confirmation email only sends once the site is deployed with the webhook URL set. The easiest full test is to deploy to Vercel using your `sk_test_` key.
