import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeEmail } from "@/features/campaigns/services/unsubscribe.service";

/**
 * RFC 8058 one-click unsubscribe. Gmail and Yahoo POST here from their own
 * "Unsubscribe" button; nobody visits it in a browser. A GET is sent on to the
 * page, which asks before acting — link scanners follow GETs.
 */
export async function POST(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("e") ?? "";
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const ok = await unsubscribeEmail(email, token);
  return NextResponse.json({ success: ok }, { status: ok ? 200 : 400 });
}

export function GET(request: NextRequest) {
  const url = new URL("/unsubscribe", request.url);
  url.search = request.nextUrl.search;
  return NextResponse.redirect(url);
}
