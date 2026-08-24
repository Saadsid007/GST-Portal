import type { Metadata } from "next";

// The page itself is a client component and cannot export metadata. Only the
// title and description are set here — noindex is inherited from the (auth)
// layout, which owns that decision for every screen in this group.
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your GSTPilot workspace to convert marketplace reports into GSTR-1.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
