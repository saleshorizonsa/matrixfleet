# MatrixFleet — Transport management for UK & EU hauliers

*Powered by Matrix Infotech Ltd*

An all-in-one SaaS for small and medium haulage and delivery companies: quotes and jobs, drag-and-drop dispatch,
live GPS map, a driver phone app with proof of delivery, customer tracking links, VAT-correct invoicing for the UK
and every EU country, e-CMR consignment notes, fleet compliance and GDPR tools. It ships in 5 languages
(English, Deutsch, Français, Español, Polski) with Stripe subscriptions on top.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (self-hosted, London) · Stripe · Leaflet/OpenStreetMap · next-intl · pdf-lib

## What's inside

| Area | Routes |
|---|---|
| Marketing site, pricing, ROI calculator | `/`, `/legal/*` |
| Sign up (14-day trial), sign in, team invites | `/signup`, `/login`, `/onboarding`, `/invite/[token]` |
| Dashboard with KPIs, charts, setup checklist, alerts | `/app` |
| Jobs & quotes with live route pricing | `/app/jobs` |
| Drag-and-drop dispatch board (realtime) | `/app/dispatch` |
| Live map of drivers (realtime) | `/app/tracking` |
| Customers with VIES / HMRC VAT checks, CSV import | `/app/customers` |
| VAT-correct invoices + PDF | `/app/invoices`, `/api/pdf/invoice/[id]` |
| CMR consignment note PDF with POD signature | `/api/pdf/cmr/[jobId]` |
| Vehicles, drivers, compliance centre | `/app/fleet/*` |
| Settings: company, pricing, team, billing, privacy/GDPR, audit log | `/app/settings/*` |
| Driver PWA: jobs, navigation, POD (signature + photos), walkaround checks, shifts/hours, GPS | `/driver/*` |
| Public consignee tracking page | `/track/[token]` |

Plans (in `src/lib/plans.ts`): **Starter** £39 / €45, **Growth** £99 / €115, **Pro** £249 / €289 per month excl. VAT.
A trial gets Growth limits for 14 days.

## Run locally

1. Open the SSH tunnel to the Supabase server (leave it running):
   ```
   ssh -i ~/.ssh/<your-key> -N -L 8000:localhost:8000 root@<your-vps-ip>
   ```
2. Copy `.env.example` to `.env.local` and fill in the Supabase anon + service role keys.
3. `npm install` then `npm run dev` → http://localhost:3000
4. Optional demo data (development/staging only): `ALLOW_DEMO_SEED=yes npm run seed:demo`. The script refuses to run without that flag, and refuses the production API unless `ALLOW_DEMO_SEED_ON_PRODUCTION=yes` is also set. Logins go to `scripts/demo-credentials.local.txt` (git-ignored).

Database migrations live in `supabase/migrations` (apply `0001_init.sql`, then the `0002_*.sql` files).
All tables are prefixed `hl_` and protected by row-level security per organisation.

Deployment: see [DEPLOYMENT.md](DEPLOYMENT.md).

## Security & secrets

**Rule: no secret ever lives in the source code.** Every key, password, token and connection string is
read from environment variables (`process.env.*`). Local values go in `.env.local` (git-ignored); production
values live in Vercel → Project → Settings → Environment Variables, marked **Sensitive**.
`.env.example` lists every variable with placeholders only.

| Variable | Exposure | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_SCHEMA`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME` | Browser | The anon key is safe **only** because row-level security is on for every table and `anon` has no table grants. Never disable RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Bypasses RLS. Used only in `src/lib/supabase/admin.ts` (guarded by `server-only`). |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Server only | Used only in `src/lib/stripe.ts` and `src/app/api/stripe/webhook`. |
| `STRIPE_PRICE_*` | Server | Not secret; must start with `price_`. |
| `MATRIXFLEET_DATABASE_URL`, `MATRIXFLEET_DIRECT_URL` | Server only | Optional, for reports/backups; contain a password. |
| `OSRM_URL`, `NOMINATIM_URL` | Server | Service URLs, not secret. |

Never give a secret the `NEXT_PUBLIC_` prefix: Next.js compiles those into the JavaScript sent to every visitor.
Errors are logged through `src/lib/safe-log.ts`, which logs only safe fields and masks anything that looks like a key.

> ### ⚠️ Git history and key rotation
> A secret that was **ever** committed stays in git history (and in every clone and fork) even after it is
> deleted from the code. If that ever happens: **rotate the secret immediately** — create a new one in the
> provider (Stripe → API keys / Webhooks, Supabase `JWT_SECRET` + anon/service keys, database password,
> Zoho app password), update Vercel and the server, redeploy, then revoke the old one. Deleting the commit is
> not enough.
>
> Audit of 28 Nov 2026: all 9 commits were scanned by pattern and against the exact values of the real keys in
> use (Supabase anon/service/JWT, Stripe secret, database and SMTP passwords) — **none were found in history**,
> so no rotation is needed because of git. Keep it that way: run a scan (e.g. `gitleaks detect`) before pushing.
