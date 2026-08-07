"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { CONTACT_CATEGORY_OPTIONS } from "@/features/support/domain/support.constants";
import { submitContactAction, type ContactInput } from "@/features/support/actions/support.actions";

const BLANK: ContactInput = {
  name: "",
  email: "",
  category: "SALES",
  subject: "",
  message: "",
  company: "",
};

export function ContactForm() {
  const [form, setForm] = useState<ContactInput>(BLANK);
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  function set<K extends keyof ContactInput>(key: K, value: ContactInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const res = await submitContactAction(form);
    setSending(false);
    if (res.success && res.data) {
      setReference(res.data.reference);
      setForm(BLANK);
    } else {
      toast.error(res.error ?? "Could not send your message");
    }
  }

  if (reference) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-success/30 bg-success/[0.06] p-8 text-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-success/15 text-success-ink ring-1 ring-success/25">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <h2 className="text-base font-semibold">Message received</h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          We reply to most messages within one business day. Keep this reference — quote it if you
          follow up.
        </p>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(reference);
            toast.success("Reference copied");
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm font-semibold transition-colors hover:border-primary/40"
        >
          {reference}
          <Copy className="size-3.5 text-muted-foreground" aria-hidden />
        </button>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => setReference(null)}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Honeypot. Hidden from people, irresistible to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.company}
          onChange={(e) => set("company", e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="contact-name" required>
          <Input
            id="contact-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Priya Raghavan"
            autoComplete="name"
            required
          />
        </Field>
        <Field label="Email" htmlFor="contact-email" required>
          <Input
            id="contact-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </Field>
      </div>

      <Field label="What is this about?" htmlFor="contact-category" required>
        <Select
          id="contact-category"
          value={form.category}
          onChange={(e) => set("category", e.target.value as ContactInput["category"])}
        >
          {CONTACT_CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Subject" htmlFor="contact-subject" required>
        <Input
          id="contact-subject"
          value={form.subject}
          onChange={(e) => set("subject", e.target.value)}
          placeholder="Bulk plan for a CA firm with 40 clients"
          required
        />
      </Field>

      <Field
        label="Message"
        htmlFor="contact-message"
        required
        hint="The more specific you are, the faster we can answer properly."
      >
        <Textarea
          id="contact-message"
          rows={5}
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          placeholder="We file GSTR-1 for around 40 e-commerce sellers each month and want to know how bulk generation and white-label reports work."
          required
        />
      </Field>

      <Button type="submit" variant="brand" size="lg" block loading={sending}>
        <Send />
        Send message
      </Button>

      <p className="text-center text-2xs text-muted-foreground">
        By sending this you agree to our{" "}
        <Link href="/privacy-policy" className="text-primary-ink underline underline-offset-2">
          privacy policy
        </Link>
        . We never share your details.
      </p>
    </form>
  );
}
