import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./form";

export const metadata = { title: "Join your team" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("auth");
  const supabase = await createClient();
  const [{ data: invite }, { data: auth }] = await Promise.all([
    supabase.rpc("hl_get_invitation", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const inv = invite as { email: string; role: string; org_name: string; expired: boolean; accepted: boolean } | null;

  if (!inv || inv.expired || inv.accepted) {
    return (
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">{t("inviteInvalidTitle")}</h1>
        <p className="mt-2 text-slate-500">{t("inviteInvalid")}</p>
      </div>
    );
  }
  return (
    <InviteForm
      token={token}
      email={inv.email}
      orgName={inv.org_name}
      role={inv.role}
      signedInEmail={auth.user?.email ?? null}
      defaultName={(auth.user?.user_metadata?.full_name as string) ?? ""}
    />
  );
}
