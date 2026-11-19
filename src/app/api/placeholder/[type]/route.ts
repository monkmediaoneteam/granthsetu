import { NextResponse } from "next/server";
import { generateCategorySvg, generateHeroBannerSvg, generateSideBannerSvg } from "@/lib/placeholders";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const url = new URL(req.url);
  const variant = url.searchParams.get("variant") || url.searchParams.get("mobile");
  const isMobile = variant === "mobile" || variant === "1" || variant === "true";

  let svg = "";

  if (type === "hero") {
    svg = generateHeroBannerSvg({ mobile: isMobile });
  } else if (type === "side") {
    const slot = url.searchParams.get("slot") || "1";
    svg = generateSideBannerSvg({ slot, mobile: isMobile });
  } else if (type === "category") {
    const slug = url.searchParams.get("slug") || "ayurveda";
    const name = url.searchParams.get("name") || slug;
    svg = generateCategorySvg({ slug, name });
  } else {
    // Default fallback hero
    svg = generateHeroBannerSvg({ mobile: false });
  }

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
