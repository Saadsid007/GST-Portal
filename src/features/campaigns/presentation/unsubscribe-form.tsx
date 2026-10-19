"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, MailX } from "lucide-react";
import { unsubscribeAction } from "@/features/campaigns/actions/unsubscribe.actions";

/** Asks before acting: mail scanners open every link, and must not unsubscribe anyone. */
export function UnsubscribeForm({ email, token }: { email: string; token: string }) {
  const [state, setState] = useState<"ask" | "done" | "invalid">(
    email && token ? "ask" : "invalid"
  );
  const [pending, start] = useTransition();

  if (state === "done") {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto size-8 text-success-ink" />
        <h1 className="text-lg font-bold">You are unsubscribed</h1>
        <p className="text-sm text-muted-foreground">
          {email} will no longer get GSTPilot offers and updates. Account emails — sign-in codes,
          receipts and support replies — still arrive.
        </p>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-card p-8 text-center">
        <MailX className="mx-auto size-8 text-muted-foreground" />
        <h1 className="text-lg font-bold">This link is not valid</h1>
        <p className="text-sm text-muted-foreground">
          Use the unsubscribe link at the bottom of one of our emails, or write to
          gstpilot.official@gmail.com and we will remove you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-8 text-center">
      <MailX className="mx-auto size-8 text-muted-foreground" />
      <h1 className="text-lg font-bold">Unsubscribe from GSTPilot emails?</h1>
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{email}</span> will stop getting offers and
        product updates.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await unsubscribeAction({ email, token });
            setState(res.success ? "done" : "invalid");
          })
        }
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Unsubscribe
      </button>
    </div>
  );
}
