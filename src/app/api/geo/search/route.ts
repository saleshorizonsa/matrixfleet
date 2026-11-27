import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geocode } from "@/lib/geo";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ results: [] });
  const countries = request.nextUrl.searchParams.get("countries") ?? undefined;
  try {
    return NextResponse.json({ results: await geocode(q.slice(0, 200), countries) });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
