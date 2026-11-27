"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOffice } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { verifyVat, type VatCheckResult } from "@/lib/vat-check";
import { country as findCountry } from "@/lib/countries";
import { num, str } from "@/lib/utils";

export type CustomerFormState = { error?: string } | undefined;

const EDIT_ROLES = ["owner", "admin", "dispatcher", "accountant"] as const;

export async function saveCustomer(_: CustomerFormState, fd: FormData): Promise<CustomerFormState> {
  const ctx = await requireOffice([...EDIT_ROLES]);
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) return { error: "nameRequired" };
  const vat = str(fd, "vat_number")?.toUpperCase().replace(/\s+/g, "") ?? null;
  const verified = fd.get("vat_verified") === "1" && !!vat;

  const payload = {
    name,
    kind: str(fd, "kind") === "individual" ? "individual" : "business",
    vat_number: vat,
    vat_verified: verified,
    vat_verified_at: verified ? new Date().toISOString() : null,
    country: (str(fd, "country") ?? ctx.org.country).toUpperCase(),
    address_line1: str(fd, "address_line1"),
    address_line2: str(fd, "address_line2"),
    city: str(fd, "city"),
    postcode: str(fd, "postcode")?.toUpperCase() ?? null,
    contact_name: str(fd, "contact_name"),
    email: str(fd, "email")?.toLowerCase() ?? null,
    phone: str(fd, "phone"),
    payment_terms_days: num(fd, "payment_terms_days"),
    rate_per_distance: num(fd, "rate_per_distance"),
    notes: str(fd, "notes"),
  };

  if (id) {
    const { error } = await ctx.supabase.from("hl_customers").update(payload).eq("id", id).eq("org_id", ctx.org.id);
    if (error) return { error: error.message };
    await audit(ctx, "customer.updated", "customer", id);
    revalidatePath("/app/customers", "layout");
    redirect(`/app/customers/${id}`);
  }
  const { data, error } = await ctx.supabase.from("hl_customers").insert({ ...payload, org_id: ctx.org.id }).select("id").single();
  if (error) return { error: error.message };
  await audit(ctx, "customer.created", "customer", data.id, { name });
  revalidatePath("/app/customers", "layout");
  redirect(`/app/customers/${data.id}`);
}

export async function deleteCustomer(id: string) {
  const ctx = await requireOffice(["owner", "admin"]);
  await ctx.supabase.from("hl_customers").delete().eq("id", id).eq("org_id", ctx.org.id);
  await audit(ctx, "customer.deleted", "customer", id);
  revalidatePath("/app/customers", "layout");
  redirect("/app/customers");
}

export async function checkVat(vat: string, countryCode: string): Promise<VatCheckResult> {
  await requireOffice();
  return verifyVat(vat, countryCode);
}

/** Re-verify a saved customer's VAT number and persist the result. */
export async function reverifyCustomerVat(id: string): Promise<VatCheckResult | null> {
  const ctx = await requireOffice([...EDIT_ROLES]);
  const { data: c } = await ctx.supabase.from("hl_customers").select("vat_number, country").eq("id", id).eq("org_id", ctx.org.id).maybeSingle();
  if (!c?.vat_number) return null;
  const res = await verifyVat(c.vat_number, c.country);
  if (!res.offline) {
    await ctx.supabase
      .from("hl_customers")
      .update({ vat_verified: res.verified, vat_verified_at: res.verified ? new Date().toISOString() : null })
      .eq("id", id);
    await audit(ctx, "customer.vat_checked", "customer", id, { verified: res.verified });
    revalidatePath(`/app/customers/${id}`);
  }
  return res;
}

export type ImportRow = Record<string, string>;

const ALIASES: Record<string, string> = {
  name: "name", company: "name", customer: "name", "company name": "name",
  vat: "vat_number", "vat number": "vat_number", vat_number: "vat_number", "vat no": "vat_number",
  country: "country", "country code": "country",
  address: "address_line1", address1: "address_line1", address_line1: "address_line1", street: "address_line1",
  address2: "address_line2", address_line2: "address_line2",
  city: "city", town: "city",
  postcode: "postcode", "post code": "postcode", zip: "postcode", "postal code": "postcode",
  contact: "contact_name", contact_name: "contact_name", "contact name": "contact_name",
  email: "email", "e-mail": "email",
  phone: "phone", telephone: "phone", tel: "phone",
  terms: "payment_terms_days", payment_terms_days: "payment_terms_days", "payment terms": "payment_terms_days",
  notes: "notes",
};

export async function importCustomers(rows: ImportRow[]): Promise<{ inserted: number; skipped: number; error?: string }> {
  const ctx = await requireOffice([...EDIT_ROLES]);
  const records = rows
    .map((raw) => {
      const r: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        const key = ALIASES[k.trim().toLowerCase()];
        if (key && v?.trim()) r[key] = v.trim();
      }
      if (!r.name) return null;
      const ctry = (r.country ?? ctx.org.country).toUpperCase().slice(0, 2);
      return {
        org_id: ctx.org.id,
        name: r.name.slice(0, 200),
        kind: "business",
        vat_number: r.vat_number?.toUpperCase().replace(/\s+/g, "") ?? null,
        country: findCountry(ctry) ? ctry : ctx.org.country,
        address_line1: r.address_line1 ?? null,
        address_line2: r.address_line2 ?? null,
        city: r.city ?? null,
        postcode: r.postcode?.toUpperCase() ?? null,
        contact_name: r.contact_name ?? null,
        email: r.email?.toLowerCase() ?? null,
        phone: r.phone ?? null,
        payment_terms_days: r.payment_terms_days && /^\d+$/.test(r.payment_terms_days) ? Number(r.payment_terms_days) : null,
        notes: r.notes ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, 2000);
  if (!records.length) return { inserted: 0, skipped: rows.length, error: "noRows" };
  const { error } = await ctx.supabase.from("hl_customers").insert(records);
  if (error) return { inserted: 0, skipped: rows.length, error: error.message };
  await audit(ctx, "customer.imported", "customer", undefined, { count: records.length });
  revalidatePath("/app/customers");
  return { inserted: records.length, skipped: rows.length - records.length };
}
