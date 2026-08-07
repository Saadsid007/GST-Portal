import { env } from "@/lib/env";

/**
 * IndexNow ownership proof. The spec wants the key as plaintext at /<key>.txt; a
 * next.config rewrite maps that to this route so the app tree keeps a single catch-all
 * out of the root (which would otherwise swallow every 404).
 *
 * Serving from env rather than a committed public/ file keeps the key out of the repo.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
): Promise<Response> {
  const { key } = await params;
  const configured = env.INDEXNOW_KEY;

  if (!configured || key !== configured) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(configured, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
