import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireOffice } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { JobForm } from "@/components/jobs/job-form";
import { loadJobFormData } from "../form-data";

export const metadata = { title: "New job" };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ customer?: string; quote?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireOffice(["owner", "admin", "dispatcher"]);
  const t = await getTranslations("jobs");
  const data = await loadJobFormData(ctx);
  const isQuote = sp.quote === "1";
  return (
    <div className="animate-fade-up">
      <Link href="/app/jobs" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {t("title")}
      </Link>
      <PageHeader title={isQuote ? t("newQuote") : t("newJob")} description={t("newJobSubtitle")} />
      <JobForm {...data} defaultCustomerId={sp.customer} defaultQuote={isQuote} />
    </div>
  );
}
