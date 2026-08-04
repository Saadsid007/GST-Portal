"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function AdminSignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await authClient.signOut();
          toast.success("Signed out of admin");
          router.push("/admin/login");
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
    >
      <LogOut className="size-3.5" /> Sign out
    </button>
  );
}
