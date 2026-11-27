import { getTranslations, getLocale } from "next-intl/server";
import { CheckCircle2, CreditCard, Info, Sparkles } from "lucide-react";
import { requireOffice, ADMIN_ROLES } from "@/lib/auth";
import { PLANS, limitsFor, trialDaysLeft, isSubscriptionActive, stripePriceId } from "@/lib/plans";
import { billingConfigured } from "@/lib/stripe";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { SubmitButton } from "@/components/app/client";
import { UsageBar } from "@/components/billing/usage-bar";
import { money, date, intlLocale } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireOffice();
  const t = await getTranslations("billing");
  const locale = intlLocale(await getLocale());
  const org = ctx.org;
  const isAdmin = ADMIN_ROLES.includes(ctx.membership.role);
  const configured = billingConfigured();
  const cur = org.currency === "GBP" ? "GBP" : "EUR";
  const limits = limitsFor(org);
  const active = isSubscriptionActive(org);

  const [{ count: vehicles }, { count: users }] = await Promise.all([
    ctx.supabase.from("hl_vehicles").select("*", { count: "exact", head: true }).eq("org_id", org.id),
    ctx.supabase.from("hl_memberships").select("*", { count: "exact", head: true }).eq("org_id", org.id),
  ]);

  const currentName = org.plan === "trial" ? t("trial") : PLANS.find((p) => p.id === org.plan)?.name;

  return (
    <div className="space-y-6">
      {sp.success && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          <CheckCircle2 className="h-4 w-4" /> {t("success")}
        </div>
      )}
      {sp.canceled && <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{t("canceled")}</div>}
      {sp.error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
          {t.has(`errors.${sp.error}`) ? t(`errors.${sp.error}`) : sp.error}
        </div>
      )}
      {!configured && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> {t("notConfigured")}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="overflow-hidden">
          <div className="relative bg-ink-900 p-6 text-white">
            <div className="bg-grid absolute inset-0 opacity-60" />
            <div className="relative">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/50">{t("currentPlan")}</div>
              <div className="mt-1 flex items-center gap-3">
                <span className="font-display text-3xl font-bold">{currentName}</span>
                <Badge tone={active ? "green" : "red"}>{(() => {
                    const key = !active ? "inactive" : org.plan === "trial" ? "trialing" : org.subscription_status;
                    return t.has(`status.${key}`) ? t(`status.${key}`) : key;
                  })()}</Badge>
              </div>
              <p className="mt-2 text-sm text-white/65">
                {org.plan === "trial"
                  ? t("trialEnds", { days: trialDaysLeft(org), date: date(org.trial_ends_at, locale) })
                  : org.current_period_end
                    ? t("renews", { date: date(org.current_period_end, locale) })
                    : null}
              </p>
            </div>
          </div>
          <CardBody className="space-y-5">
            <UsageBar label={t("vehicles")} used={vehicles ?? 0} limit={limits.vehicles} unlimited={t("unlimited")} />
            <UsageBar label={t("users")} used={users ?? 0} limit={limits.users} unlimited={t("unlimited")} />
            {isAdmin && org.stripe_customer_id && configured && (
              <form action="/api/stripe/portal" method="post">
                <SubmitButton variant="secondary">
                  <CreditCard className="h-4 w-4" /> {t("manage")}
                </SubmitButton>
              </form>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("invoicesTitle")} />
          <CardBody className="space-y-3 text-sm text-slate-600">
            <p>{t("invoicesNote")}</p>
            <p>{t("vatNote")}</p>
            <p className="text-xs text-slate-400">{t("secureNote")}</p>
          </CardBody>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 font-display text-lg font-semibold">{t("choosePlan")}</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = org.plan === plan.id;
            const purchasable = configured && !!stripePriceId(plan.id, org.currency);
            return (
              <Card
                key={plan.id}
                className={cn("relative flex flex-col p-6", plan.highlight && "ring-2 ring-brand-500", isCurrent && "bg-brand-50/40")}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">
                    <Sparkles className="h-3 w-3" /> {t("popular")}
                  </span>
                )}
                <div className="font-display text-lg font-semibold">{plan.name}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">{money(plan.price[cur], cur, locale).replace(/[.,]00$/, "")}</span>
                  <span className="text-sm text-slate-500">{t("perMonth")}</span>
                </div>
                <div className="text-xs text-slate-500">{t("exclVat")}</div>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    {Number.isFinite(plan.vehicles) ? t("upToVehicles", { n: plan.vehicles }) : t("unlimitedVehicles")}
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    {Number.isFinite(plan.users) ? t("upToUsers", { n: plan.users }) : t("unlimitedUsers")}
                  </li>
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      {t(`features.${f}`)}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCurrent ? (
                    <div className="rounded-xl bg-white py-2.5 text-center text-sm font-medium text-brand-700 ring-1 ring-brand-200">{t("yourPlan")}</div>
                  ) : isAdmin ? (
                    org.stripe_subscription_id && configured ? (
                      <form action="/api/stripe/portal" method="post">
                        <SubmitButton variant={plan.highlight ? "primary" : "secondary"} className="w-full">
                          {t("switchPlan")}
                        </SubmitButton>
                      </form>
                    ) : (
                      <form action="/api/stripe/checkout" method="post">
                        <input type="hidden" name="plan" value={plan.id} />
                        <SubmitButton variant={plan.highlight ? "primary" : "secondary"} className="w-full" disabled={!purchasable}>
                          {t("subscribe", { plan: plan.name })}
                        </SubmitButton>
                      </form>
                    )
                  ) : (
                    <p className="text-center text-xs text-slate-500">{t("askAdmin")}</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
