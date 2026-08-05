"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldMinus, UserPlus } from "lucide-react";
import {
  grantAdminAction,
  listAdminsAction,
  revokeAdminAction,
  type AdminRow,
} from "@/features/auth/actions/admin-users.actions";

export function AdminUsersPanel() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void listAdminsAction().then((result) => {
      if (result.success) setRows(result.data);
    });
  }, []);

  async function reload() {
    const result = await listAdminsAction();
    if (result.success) setRows(result.data);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="size-4 text-primary" /> Administrators
        </h2>
        <p className="pt-0.5 text-[11px] text-muted-foreground">
          The account must already be registered. Roles are read from the database on every request,
          so revoking access takes effect immediately.
        </p>
      </div>

      <div className="flex max-w-md flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await grantAdminAction({ email });
              if (result.success) {
                toast.success("Admin access granted");
                setEmail("");
                await reload();
              } else toast.error(result.error);
            })
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold whitespace-nowrap text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <UserPlus className="size-3.5" />
          )}{" "}
          Add admin
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="bg-muted/50 text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2.5 text-left font-bold">Name</th>
              <th className="px-4 py-2.5 text-left font-bold">Email</th>
              <th className="px-4 py-2.5 text-left font-bold">Admin since</th>
              <th className="px-4 py-2.5 text-right font-bold" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-2.5 font-semibold">{row.name}</td>
                <td className="px-4 py-2.5 font-mono text-muted-foreground">{row.email}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.createdAt.slice(0, 10)}</td>
                <td className="px-4 py-2.5 text-right">
                  {row.isSelf ? (
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                      You
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await revokeAdminAction(row.id);
                          if (result.success) {
                            toast.success("Admin access revoked");
                            await reload();
                          } else toast.error(result.error);
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[10px] font-bold uppercase transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <ShieldMinus className="size-3" /> Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
