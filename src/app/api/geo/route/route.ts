import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { route } from "@/lib/geo";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const vals = ["fromLat", "fromLng", "toLat", "toLng"].map((k) => Number(sp.get(k)));
  if (vals.some((v) => !Number.isFinite(v))) return NextResponse.json({ error: "bad coordinates" }, { status: 400 });
  const [fromLat, fromLng, toLat, toLng] = vals;
  return NextResponse.json(await route(fromLat, fromLng, toLat, toLng));
}
