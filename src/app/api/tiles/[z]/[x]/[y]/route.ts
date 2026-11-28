import { NextResponse, type NextRequest } from "next/server";

/**
 * Map tiles served from our own domain.
 *
 * - Privacy: visitors' browsers (including consignees on public tracking links) never contact the
 *   tile provider, so it doesn't see their IP address.
 * - Security: the Content-Security-Policy can keep img-src to our own domain.
 * - Provider: MAP_TILE_URL (server-only) — e.g. a MapTiler/Stadia URL with its API key, which then
 *   never reaches the browser. Defaults to OpenStreetMap's tile server (fine for testing; OSM's
 *   usage policy discourages heavy commercial use, so set a paid provider for production).
 * - Load: responses are cached by the browser and Vercel's CDN for a week.
 */
const DEFAULT_TEMPLATE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const UA = "MatrixFleet/1.0 (+https://fleet.matrixinfo.co.uk)";

export async function GET(request: NextRequest, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  // only our own pages may use this proxy (blocks other sites hot-linking it)
  if (request.headers.get("sec-fetch-site") === "cross-site") return new NextResponse(null, { status: 403 });

  const p = await params;
  const z = Number(p.z), x = Number(p.x), y = Number(String(p.y).replace(/\.png$/, ""));
  const max = 2 ** z;
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > 19 || x < 0 || y < 0 || x >= max || y >= max) {
    return new NextResponse(null, { status: 400 });
  }

  const template = process.env.MAP_TILE_URL?.trim() || DEFAULT_TEMPLATE;
  const url = template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return new NextResponse(null, { status: 502 });
    return new NextResponse(await res.arrayBuffer(), {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 504 });
  }
}
