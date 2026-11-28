import { NextResponse } from "next/server";
import { getContext, ADMIN_ROLES } from "@/lib/auth";
import { audit } from "@/lib/audit";

const TABLES = [
  "hl_memberships",
  "hl_invitations",
  "hl_customers",
  "hl_drivers",
  "hl_vehicles",
  "hl_jobs",
  "hl_job_events",
  "hl_invoices",
  "hl_invoice_lines",
  "hl_vehicle_checks",
  "hl_driver_shifts",
  "hl_driver_locations",
  "hl_audit_logs",
] as const;

/**
 * Live access tokens are not personal data and must not travel in an export file:
 * an invitation token lets anyone join the company, a tracking token opens a shipment page.
 */
const TOKEN_FIELDS = ["token", "tracking_token"];
function redactTokens(row: unknown) {
  if (!row || typeof row !== "object") return row;
  const copy = { ...(row as Record<string, unknown>) };
  for (const f of TOKEN_FIELDS) if (f in copy && copy[f]) copy[f] = "[redacted]";
  return copy;
}

/** GDPR Art. 15/20 — portable JSON export of everything the organisation holds. */
export async function GET() {
  const ctx = await getContext();
  if (!ADMIN_ROLES.includes(ctx.membership.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const data: Record<string, unknown> = {};
  data.organization = ctx.org;
  for (const table of TABLES) {
    const rows: unknown[] = [];
    // page through (PostgREST max rows is usually 1000)
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await ctx.supabase.from(table).select("*").eq("org_id", ctx.org.id).range(from, from + 999);
      if (error || !page?.length) break;
      rows.push(...page);
      if (page.length < 1000) break;
    }
    data[table.replace(/^hl_/, "")] = rows.map(redactTokens);
  }

  await audit(ctx, "gdpr.export", "organization", ctx.org.id);

  const body = JSON.stringify(
    { exported_at: new Date().toISOString(), exported_by: ctx.user.email, format: "matrixfleet-export-v1", data },
    null,
    2,
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="matrixfleet-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
