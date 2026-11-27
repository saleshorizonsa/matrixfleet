# Going live: GitHub → Vercel → Supabase (London) → Stripe

Do these in order. Steps 1–2 are **required** before the app can work on Vercel.

## 1. Make the Supabase API reachable over HTTPS (required)

Right now the Supabase API (port 8000) is only reachable through an SSH tunnel. Vercel and drivers' phones need
a public HTTPS address.

1. Point a DNS record at the VPS, e.g. `api.yourdomain.com → <your-vps-ip>`.
2. Install Caddy on the VPS and reverse-proxy to Kong (it fetches TLS certificates automatically):
   ```
   # /etc/caddy/Caddyfile
   api.yourdomain.com {
       reverse_proxy localhost:8000
   }
   ```
3. In `/opt/supabase/.env` set:
   - `API_EXTERNAL_URL=https://api.yourdomain.com`
   - `SUPABASE_PUBLIC_URL=https://api.yourdomain.com`
   - `SITE_URL=https://app.yourdomain.com` (your Vercel domain)
   - `ADDITIONAL_REDIRECT_URLS=https://app.yourdomain.com/**,http://localhost:3000/**`

   Then restart: `cd /opt/supabase && sh run.sh stop && sh run.sh start`.
4. Firewall: allow only 22, 80 and 443 publicly. Keep 8000 and Studio closed (use the SSH tunnel for Studio).

> Note: MatrixFleet shares this Supabase instance with MatrixPOS (separate `hl_*` tables in `public`; MatrixPOS uses
> the `matrixpos` schema). Both apps share the same login user pool. For full isolation, run a second Supabase stack later.

## 2. Email (required for sign-up confirmations and magic links)

Email confirmation is switched on (`mailer_autoconfirm: false`), so Supabase must be able to send email.
Use an EU/UK SMTP provider (for example Brevo, Postmark or Resend) and set the following in `/opt/supabase/.env`:
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME=MatrixFleet`.
Restart Supabase afterwards. Team and driver invites are currently shared as copyable links / mailto: links.

## 3. Database

All MatrixFleet tables live in the isolated `matrixfleet` schema, owned by the `matrixfleet` database login
(credentials in `matrixfleet-credentials.txt`, never commit it). MatrixPOS data in the `matrixpos` schema is not reachable from it.

- Already applied on the London server: `0001_init.sql`, the three `0002_*.sql` files and `0003_ownership_and_grants.sql`.
- The Supabase API serves the schema because `/opt/supabase/.env` has `PGRST_DB_SCHEMAS=public,graphql_public,matrixfleet`
  (after changing it: `sh run.sh recreate rest`).
- For a fresh server: run the migrations in order as `supabase_admin` (they need `set role postgres` for 0001–0002 and
  a member of the `matrixfleet` role for 0003), then add `matrixfleet` to `PGRST_DB_SCHEMAS`.

## 4. GitHub

The code is in the private repo `saleshorizonsa/matrixfleet` (branch `main`). Push changes with `git push`.
`.env*` files and `*credentials*.txt` are git-ignored — double-check `git status` before every push.

## 5. Vercel

1. vercel.com → **Add New → Project** → import the `saleshorizonsa/matrixfleet` GitHub repo (framework: Next.js).
2. Functions run in London (`lhr1`, set in `vercel.json`) — close to the database and inside the UK.
3. Environment variables (Production + Preview):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_SUPABASE_SCHEMA` | `matrixfleet` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ANON_KEY` from your credentials file |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY` (server only — never prefix with `NEXT_PUBLIC_`) |
| `NEXT_PUBLIC_APP_URL` | `https://app.yourdomain.com` |
| `NEXT_PUBLIC_APP_NAME` | `MatrixFleet` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | from Stripe (step 6) |
| `STRIPE_PRICE_{STARTER,GROWTH,PRO}_{GBP,EUR}` | the 6 price IDs from Stripe |
| `OSRM_URL`, `NOMINATIM_URL` | see step 7 |

4. Add your custom domain under **Settings → Domains**.

## 6. Stripe (subscriptions)

1. Create 3 products (Starter, Growth, Pro), each with a monthly **GBP** price and a monthly **EUR** price → 6 price IDs.
2. Turn on **Stripe Tax** and register for UK VAT (and EU OSS if applicable).
3. Turn on the **Customer Portal** (Settings → Billing → Customer portal): allow plan switching, cancellation and invoice history.
4. Add a webhook endpoint `https://app.yourdomain.com/api/stripe/webhook` with events:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Test with Stripe test keys first; switch to live keys when ready.

## 7. Maps and routing in production

The defaults use the free public OpenStreetMap servers, which are **not allowed for commercial production traffic**.
Before launch, switch to one of:
- Self-hosted OSRM + Nominatim on the VPS (free, needs ~8–16 GB RAM for UK + EU extracts), or
- A paid provider with an OSRM-compatible routing API and a Nominatim-compatible geocoder, then set `OSRM_URL` / `NOMINATIM_URL`.

Map tiles (`tile.openstreetmap.org`) have the same policy — for production use a tile provider such as MapTiler or Stadia Maps.

## 8. Before you take money

- Fill in the `[●]` placeholders in `/legal/*` (company number, registered address, contact emails, EU representative)
  and have Terms, Privacy Policy and DPA reviewed by a lawyer.
- Register with the ICO (UK data protection fee).
- Check the VAT rules in `src/lib/vat.ts` with your accountant; users can always override the suggested treatment.
- Set up off-site backups (the credentials file notes Google Drive copy is not configured yet).
