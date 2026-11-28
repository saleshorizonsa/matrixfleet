# Going live: GitHub → Vercel → Supabase (London) → Stripe

Do these in order. Steps 1–2 are **required** before the app can work on Vercel.

## 1. Domains and HTTPS: done

| Address | Points to | Purpose |
|---|---|---|
| `https://fleet.matrixinfo.co.uk` | Vercel (A 76.76.21.21) | the MatrixFleet app, driver app and tracking links |
| `https://api.matrixinfo.co.uk` | London VPS (A record) | Supabase API, served by Caddy with a Let's Encrypt certificate |

- DNS is managed at Hostinger (records `fleet` and `api`).
- Caddy config: `/etc/caddy/Caddyfile` on the VPS. Only the client API paths are public
  (`/auth/v1`, `/rest/v1`, `/storage/v1`, `/realtime/v1`, `/functions/v1`, `/graphql/v1`); Studio and `/pg` return 404.
  Use the SSH tunnel to `localhost:8000` for Studio. Certificates renew automatically.
- Firewall (ufw): 22, 80, 443, 5432, 6543 open; 8000 is bound to localhost only.
- Supabase `/opt/supabase/.env`: `SUPABASE_PUBLIC_URL=https://api.matrixinfo.co.uk`,
  `API_EXTERNAL_URL=https://api.matrixinfo.co.uk/auth/v1`, `SITE_URL=https://fleet.matrixinfo.co.uk`,
  `ADDITIONAL_REDIRECT_URLS=https://fleet.matrixinfo.co.uk/**,http://localhost:3000/**` (backups: `.env.bak-*`).

## 2. Email: done (Zoho)

Supabase sends sign-up confirmations, sign-in links and password resets through Zoho Mail:
`SMTP_HOST=smtp.zoho.com`, `SMTP_PORT=587` (STARTTLS), `SMTP_USER=info@matrixinfo.co.uk`, sender name `MatrixFleet`,
password = a Zoho app password (stored only in `/opt/supabase/.env` and your local credentials file).
To rotate it: create a new app password in Zoho, update `SMTP_PASS` in `/opt/supabase/.env`, then `sh run.sh recreate auth`.

Limits: the Zoho free plan caps daily sending. When sign-ups grow, move to Zoho Mail Lite or a transactional
service (Brevo, Postmark) by changing the same SMTP_* values. Team and driver invites are still shared as links.

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
2. Functions run in London (`lhr1`, set in `vercel.json`). The project is deployed from the CLI (`vercel deploy --prod`); `.vercelignore` keeps local secrets out of uploads. Connect the GitHub repo under Project → Settings → Git for automatic deploys.
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
| `STRIPE_PRICE_{STARTER,GROWTH,PRO}_{GBP,EUR}` | the 6 base price IDs from Stripe |
| `STRIPE_PRICE_{GROWTH,PRO}_EXTRA_VEHICLE_{GBP,EUR}` | the 4 per-extra-vehicle price IDs |
| `OSRM_URL`, `NOMINATIM_URL` | see step 7 |

4. Add your custom domain under **Settings → Domains**.

## 6. Stripe (subscriptions)

1. Create the products and monthly recurring prices (excl. VAT):

   | Product | GBP | EUR | Includes |
   |---|---|---|---|
   | Starter | £39 | €45 | up to 3 vehicles, 3 users (no extras: upgrade) |
   | Growth | £119 | €139 | 10 vehicles, 10 users |
   | Growth extra vehicle | £9 per unit | €10 per unit | each vehicle above 10 |
   | Pro | £279 | €325 | 30 vehicles, unlimited users |
   | Pro extra vehicle | £7 per unit | €8 per unit | each vehicle above 30 |

   That is 10 price IDs. The extra-vehicle prices must be **per unit** (quantity-based). The app sets the quantity
   automatically whenever a customer adds or removes vehicles, swaps the price when they change plan, and Stripe
   prorates the difference. Pro becomes cheaper than Growth from about 28 vehicles. Free trials are capped at 30 vehicles.
   Plan prices and limits live in `src/lib/plans.ts`; keep them in step with Stripe.
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

## Security hardening (launch checklist, 28 Nov 2026)

| Area | Where |
|---|---|
| Startup env check — server refuses to start if a critical variable is missing/invalid | `src/lib/env.ts`, `src/instrumentation.ts` |
| Generic errors with a reference ID; details only in server logs | `src/lib/action-error.ts`, `src/app/error.tsx`, `src/app/global-error.tsx` |
| Security headers (HSTS 1y, X-Frame-Options DENY, nosniff, Permissions-Policy, COOP) | `next.config.ts` |
| Content-Security-Policy with a per-request nonce | `src/lib/csp.ts`, `src/proxy.ts` |
| Map tiles proxied through our domain (`MAP_TILE_URL`, server-only) | `src/app/api/tiles/[z]/[x]/[y]/route.ts` |
| Rate limits: sign-in 5/min/IP + 10/15min/email; sign-up 5/h/IP + 3/h/email; email link (= password reset) 3/h/email; invites 10/h/IP | `src/lib/rate-limit.ts`, `supabase/migrations/0005_rate_limits.sql` |
| API gateway: password sign-in, sign-up, OTP, magic link and recovery only accepted with `X-MF-Gateway` (`SUPABASE_AUTH_GATEWAY_KEY`) — no rate-limit bypass via the API | `infra/caddy/Caddyfile` |
| CORS on the API: only `https://fleet.matrixinfo.co.uk` (+ localhost for development) | `infra/caddy/Caddyfile` |
| Database pooler (5432/6543) refuses connections without TLS (`enforce_ssl`) | `/opt/supabase/volumes/pooler/pooler.exs` + `_supavisor.tenants` |

**Changing the Caddy config safely** (always validate before installing):
```
set -a; . /etc/caddy/mf-gateway.env; set +a
caddy validate --config /tmp/Caddyfile.new --adapter caddyfile && install -m 644 /tmp/Caddyfile.new /etc/caddy/Caddyfile && systemctl reload caddy
```
**Rotating the gateway key:** generate a new value, update `SUPABASE_AUTH_GATEWAY_KEY` in Vercel (Production + Preview) and
`/etc/caddy/mf-gateway.env` (+ `mf-gateway.key`), redeploy the app first, then `systemctl restart caddy`.
