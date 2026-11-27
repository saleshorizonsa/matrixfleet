import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, isExtraVehiclePrice, planFromSubscription, syncExtraVehicles } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function syncSubscription(sub: Stripe.Subscription, fallbackOrgId?: string | null) {
  const admin = createAdminClient();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  // the base plan line (a Pro subscription may also carry an "extra vehicles" line)
  const item = sub.items.data.find((i) => !isExtraVehiclePrice(i.price?.id)) ?? sub.items.data[0];
  const plan = planFromSubscription(sub) ?? (sub.metadata?.plan as "starter" | "growth" | "pro" | undefined) ?? null;
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null;
  const ended = sub.status === "canceled" || sub.status === "incomplete_expired";

  const update: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: ended ? null : sub.id,
    subscription_status: sub.status,
    current_period_end: periodEnd,
  };
  if (plan && !ended) update.plan = plan;

  const orgId = sub.metadata?.org_id || fallbackOrgId;
  const q = admin.from("hl_organizations").update(update);
  const { error } = orgId ? await q.eq("id", orgId) : await q.eq("stripe_customer_id", customerId);
  if (error) throw error;

  const { data: org } = orgId
    ? await admin.from("hl_organizations").select("id").eq("id", orgId).maybeSingle()
    : await admin.from("hl_organizations").select("id").eq("stripe_customer_id", customerId).maybeSingle();
  if (org) {
    await admin.from("hl_audit_logs").insert({
      org_id: org.id,
      action: `billing.subscription_${sub.status}`,
      entity: "subscription",
      entity_id: sub.id,
      details: { plan, status: sub.status },
    });
    // plan changes (e.g. upgrading to Pro in the portal) can change how many vehicles are billed;
    // this is a no-op when the quantity is already right, so it cannot loop with its own webhook
    if (!ended) await syncExtraVehicles(org.id);
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "not configured" }, { status: 400 });

  const stripe = getStripe();
  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    return NextResponse.json({ error: `invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub, session.client_reference_id ?? session.metadata?.org_id);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const admin = createAdminClient();
          const { data: org } = await admin
            .from("hl_organizations")
            .update({ subscription_status: "past_due" })
            .eq("stripe_customer_id", customerId)
            .select("id")
            .maybeSingle();
          if (org) {
            await admin.from("hl_audit_logs").insert({
              org_id: org.id,
              action: "billing.payment_failed",
              entity: "invoice",
              entity_id: invoice.id,
              details: { amount_due: invoice.amount_due, currency: invoice.currency },
            });
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe webhook]", err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
