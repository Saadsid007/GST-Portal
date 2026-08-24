import type { Metadata } from "next";

// The page itself is a client component and cannot export metadata. Only the
// title and description are set here — noindex is inherited from the (auth)
// layout, which owns that decision for every screen in this group.
export const metadata: Metadata = {
  title: "Verify your email",
  description: "Enter the one-time code sent to your email to activate your GSTPilot account.",
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
