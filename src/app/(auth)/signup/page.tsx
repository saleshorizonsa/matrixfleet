import type { Metadata } from "next";
import { SignupForm } from "./form";

export const metadata: Metadata = { title: "Start your free trial" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const sp = await searchParams;
  return <SignupForm plan={sp.plan} />;
}
