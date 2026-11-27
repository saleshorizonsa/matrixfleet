import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./form";

export const metadata = { title: "Set up your company" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/onboarding");
  const { data: m } = await supabase.from("hl_memberships").select("org_id").eq("user_id", data.user.id).limit(1).maybeSingle();
  if (m) redirect("/app");
  const meta = (data.user.user_metadata ?? {}) as Record<string, string>;
  return <OnboardingForm defaults={{ company: meta.company, full_name: meta.full_name, country: meta.country ?? "GB", currency: meta.currency }} />;
}
