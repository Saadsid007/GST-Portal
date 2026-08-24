import type { Metadata } from "next";

// The page itself is a client component and cannot export metadata. Only the
// title and description are set here — noindex is inherited from the (auth)
// layout, which owns that decision for every screen in this group.
export const metadata: Metadata = {
  title: "Set a new password",
  description: "Enter your one-time code and choose a new GSTPilot password.",
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
