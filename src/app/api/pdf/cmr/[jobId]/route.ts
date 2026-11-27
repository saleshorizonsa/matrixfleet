import { NextResponse, type NextRequest } from "next/server";
import { getContext } from "@/lib/auth";
import { buildCmrPdf } from "@/lib/pdf/cmr";
import { pdfResponse } from "@/lib/pdf/draw";
import type { Customer, Job } from "@/lib/types";

export const runtime = "nodejs";

/** CMR consignment note for a job. Office staff and the assigned driver (via RLS) can download it. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const ctx = await getContext();
  const sb = ctx.supabase;

  const { data: job } = await sb.from("hl_jobs").select("*").eq("id", jobId).maybeSingle<Job>();
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [customerRes, driverRes, vehicleRes, signature, logo] = await Promise.all([
    job.customer_id ? sb.from("hl_customers").select("*").eq("id", job.customer_id).maybeSingle<Customer>() : Promise.resolve({ data: null }),
    job.driver_id ? sb.from("hl_drivers").select("full_name").eq("id", job.driver_id).maybeSingle<{ full_name: string }>() : Promise.resolve({ data: null }),
    job.vehicle_id ? sb.from("hl_vehicles").select("registration").eq("id", job.vehicle_id).maybeSingle<{ registration: string }>() : Promise.resolve({ data: null }),
    job.pod_signature_path ? downloadBytes(sb, job.pod_signature_path) : Promise.resolve(null),
    ctx.org.logo_url ? fetchBytes(ctx.org.logo_url) : Promise.resolve(null),
  ]);

  const bytes = await buildCmrPdf({
    job,
    org: ctx.org,
    customer: (customerRes.data as Customer | null) ?? null,
    driverName: (driverRes.data as { full_name: string } | null)?.full_name ?? null,
    vehicleRegistration: (vehicleRes.data as { registration: string } | null)?.registration ?? null,
    signatureBytes: signature,
    logoBytes: logo,
  });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return pdfResponse(bytes, `CMR-${job.reference}.pdf`, !download);
}

async function downloadBytes(sb: Awaited<ReturnType<typeof getContext>>["supabase"], path: string) {
  try {
    const { data } = await sb.storage.from("hl-pod").download(path);
    return data ? new Uint8Array(await data.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

async function fetchBytes(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
