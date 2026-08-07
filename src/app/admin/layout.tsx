import type { Metadata } from "next";
import { NOINDEX_METADATA } from "@/lib/seo/metadata";

// The admin login page is a client component and cannot export metadata itself,
// so the noindex header is set here.
export const metadata: Metadata = NOINDEX_METADATA;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
