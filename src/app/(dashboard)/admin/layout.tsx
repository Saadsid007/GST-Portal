import { redirect } from "next/navigation";
import { isAdmin } from "@/features/auth";

/**
 * Admin now lives inside the main app shell rather than a parallel application,
 * so the guard moves here. This is defence in depth, not the only check —
 * every admin server action re-verifies the role independently, because a
 * layout guard cannot protect a directly-invoked action.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/dashboard");
  return <>{children}</>;
}
