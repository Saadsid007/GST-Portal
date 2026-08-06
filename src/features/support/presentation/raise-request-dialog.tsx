"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LifeBuoy, Send } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { USER_CATEGORY_OPTIONS } from "@/features/support/domain/support.constants";
import {
  submitSupportRequestAction,
  type SupportInput,
} from "@/features/support/actions/support.actions";

const BLANK: SupportInput = { category: "PAYMENT", subject: "", message: "", referenceId: "" };

export function RaiseRequestDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<SupportInput>(BLANK);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof SupportInput>(key: K, value: SupportInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const active = USER_CATEGORY_OPTIONS.find((o) => o.value === form.category);
  // Payment problems are the case where a reference is the difference between a
  // one-reply resolution and a three-day thread.
  const wantsReference = form.category === "PAYMENT" || form.category === "BILLING";

  async function submit() {
    setSaving(true);
    const res = await submitSupportRequestAction(form);
    setSaving(false);
    if (res.success && res.data) {
      toast.success(`Request raised — ${res.data.reference}`);
      onClose();
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not raise your request");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      icon={<LifeBuoy className="size-4 text-primary-ink" aria-hidden />}
      title="Raise a support request"
      description="Goes straight to the team. You can track it here until it is resolved."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={submit}>
            <Send />
            Submit request
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <Field label="What went wrong?" htmlFor="sup-category" required hint={active?.hint}>
          <Select
            id="sup-category"
            value={form.category}
            onChange={(e) => set("category", e.target.value as SupportInput["category"])}
          >
            {USER_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Subject" htmlFor="sup-subject" required>
          <Input
            id="sup-subject"
            value={form.subject}
            onChange={(e) => set("subject", e.target.value)}
            placeholder="Paid ₹199 by UPI but credits never arrived"
          />
        </Field>

        {wantsReference && (
          <Field
            label="Payment or order reference"
            htmlFor="sup-ref"
            hint="Optional, but it lets us find your payment immediately. Any UPI reference, order id or the amount and time works."
          >
            <Input
              id="sup-ref"
              value={form.referenceId}
              onChange={(e) => set("referenceId", e.target.value)}
              placeholder="pay_TMEZPVFEkrrHnE or UPI ref 431290558812"
            />
          </Field>
        )}

        <Field
          label="What happened?"
          htmlFor="sup-message"
          required
          hint="Include what you expected, what you saw, and roughly when."
        >
          <Textarea
            id="sup-message"
            rows={6}
            value={form.message}
            onChange={(e) => set("message", e.target.value)}
            placeholder="I paid ₹199 through the UPI QR at about 4:30pm today. The money left my account and I got a UPI confirmation, but my wallet still shows 0 credits."
          />
        </Field>
      </div>
    </Modal>
  );
}
