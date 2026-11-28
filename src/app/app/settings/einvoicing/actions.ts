"use server";
import { revalidatePath } from "next/cache";
import { requireOffice, ADMIN_ROLES } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { str } from "@/lib/utils";
import { onboardZatca, ZatcaSetupError, type ZatcaEnv } from "@/lib/zatca";
import { logError } from "@/lib/safe-log";
import { rateLimit } from "@/lib/rate-limit";

export type ZatcaConnectState = { ok?: boolean; error?: string } | undefined;

const ENVS: ZatcaEnv[] = ["sandbox", "simulation", "production"];

export async function connectZatca(_: ZatcaConnectState, fd: FormData): Promise<ZatcaConnectState> {
  const ctx = await requireOffice(ADMIN_ROLES);
  const env = str(fd, "environment") as ZatcaEnv | null;
  const otp = (str(fd, "otp") ?? "").replace(/\s+/g, "");
  if (!env || !ENVS.includes(env)) return { error: "environment" };
  if (!/^\d{6}$/.test(otp)) return { error: "otp_format" };
  const limited = await rateLimit([{ scope: "zatca-connect", value: ctx.org.id, max: 10, windowSec: 3600 }]);
  if (!limited.ok) return { error: "rate_limited" };

  try {
    const status = await onboardZatca(ctx.org, env, otp);
    await audit(ctx, "zatca.connected", "organization", ctx.org.id, { environment: env, egs: status.egsSerial });
  } catch (e) {
    const code = e instanceof ZatcaSetupError ? e.message : "unexpected";
    if (!(e instanceof ZatcaSetupError)) logError("[zatca] onboarding failed", e);
    await audit(ctx, "zatca.connect_failed", "organization", ctx.org.id, { environment: env, reason: code });
    revalidatePath("/app/settings/einvoicing");
    return { error: code };
  }
  revalidatePath("/app/settings/einvoicing");
  return { ok: true };
}
