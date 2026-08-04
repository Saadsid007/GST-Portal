import { redirect } from "next/navigation";
import { getServerSession, isAdmin } from "@/features/auth";
import { AppShell } from "@/components/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return (
    <AppShell user={session.user} showAdmin={await isAdmin()}>
      {children}
    </AppShell>
  );
}
