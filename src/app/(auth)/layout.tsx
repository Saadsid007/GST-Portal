import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/features/auth";
import { NOINDEX_METADATA } from "@/lib/seo/metadata";

// Login and register are intentionally absent from the sitemap and must not be
// indexed — they are unlisted public routes, not content.
export const metadata: Metadata = NOINDEX_METADATA;

/**
 * A signed-in, verified user has no business on the sign-in screens. Checked
 * against the real session — not the cookie, which outlives it — so an
 * expired or revoked session lands on the form instead of in a loop. An
 * unverified session is let through: /verify-email is where it must go.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (session?.user.emailVerified) redirect("/dashboard");
  return children;
}
