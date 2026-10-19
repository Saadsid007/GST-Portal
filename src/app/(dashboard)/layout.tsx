import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession, isAdmin, recordActivity } from "@/features/auth";
import { AppShell } from "@/components/app-shell";
import { NOINDEX_METADATA } from "@/lib/seo/metadata";

// Belt and braces: robots.txt already disallows these prefixes, but a crawler
// that reaches a signed-out redirect via an inbound link still gets the header.
export const metadata: Metadata = NOINDEX_METADATA;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  // Sign-in now refuses an unverified address, but sessions opened before
  // verification was enforced are still live. They finish the code step
  // first, and stay signed in while they do.
  if (!session.user.emailVerified) {
    redirect(`/verify-email?email=${encodeURIComponent(session.user.email)}`);
  }

  recordActivity(session.user.id);
  const admin = await isAdmin();

  return (
    <AppShell user={session.user} isAdmin={admin}>
      {children}
    </AppShell>
  );
}
