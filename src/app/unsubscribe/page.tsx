import type { Metadata } from "next";
import Link from "next/link";
import { NOINDEX_METADATA } from "@/lib/seo/metadata";
import { AppLogo } from "@/components/app-logo";
import { UnsubscribeForm } from "@/features/campaigns/presentation/unsubscribe-form";

// Outside (marketing) on purpose: a per-person link, never a page to index.
export const metadata: Metadata = { ...NOINDEX_METADATA, title: "Unsubscribe" };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string }>;
}) {
  const { e = "", t = "" } = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-16">
      <Link href="/" aria-label="GSTPilot home">
        <AppLogo size="lg" />
      </Link>
      <div className="w-full max-w-md">
        <UnsubscribeForm email={e} token={t} />
      </div>
    </div>
  );
}
