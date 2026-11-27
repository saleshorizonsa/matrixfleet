import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireOffice } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { JobForm } from "@/components/jobs/job-form";
import { loadJobFormData } from "../../form-data";
import type { Job } from "@/lib/types";

export const metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOffice(["owner", "admin", "dispatcher"]);
  const t = await getTranslations("jobs");
  const [{ data: job }, data] = await Promise.all([
    ctx.supabase.from("hl_jobs").select("*").eq("id", id).eq("org_id", ctx.org.id).maybeSingle<Job>(),
    loadJobFormData(ctx),
  ]);
  if (!job) notFound();
  return (
    <div className="animate-fade-up">
      <Link href={`/app/jobs/${job.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {job.reference}
      </Link>
      <PageHeader title={t("editJob", { reference: job.reference })} />
      <JobForm {...data} job={job} />
    </div>
  );
}
