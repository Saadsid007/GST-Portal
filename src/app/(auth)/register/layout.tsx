import type { Metadata } from "next";

// The page itself is a client component and cannot export metadata. Only the
// title and description are set here — noindex is inherited from the (auth)
// layout, which owns that decision for every screen in this group.
export const metadata: Metadata = {
  title: "Create your account",
  description: "Start a 30-day free trial with 7 GSTIN slots and unlimited GSTR-1 generation.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
