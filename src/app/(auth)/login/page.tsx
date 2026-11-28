import type { Metadata } from "next";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; confirmed?: string }>;
}) {
  const sp = await searchParams;
  return (
    <LoginForm
      next={sp.next ?? "/app"}
      initialError={sp.error}
      initialMessage={sp.confirmed ? "confirmed" : undefined}
    />
  );
}
