"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import type { Announcement } from "@/generated/prisma/client";
import {
  deleteAnnouncementAction,
  saveAnnouncementAction,
  setAnnouncementActiveAction,
  type AnnouncementInput,
} from "@/features/announcements/actions/announcement.actions";
import { OfferStrip } from "@/features/announcements/presentation/offer-strip";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Textarea } from "@/components/ui";

const BLANK: AnnouncementInput = {
  message: "",
  linkLabel: "",
  linkHref: "",
  isActive: true,
  sortOrder: 0,
  startsAt: "",
  endsAt: "",
};

/** ISO timestamp -> value a datetime-local input accepts. */
function toLocalInput(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AdminAnnouncementsPanel({ announcements }: { announcements: Announcement[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const open = creating || editing !== null;
  const initial: AnnouncementInput = editing
    ? {
        message: editing.message,
        linkLabel: editing.linkLabel ?? "",
        linkHref: editing.linkHref ?? "",
        isActive: editing.isActive,
        sortOrder: editing.sortOrder,
        startsAt: toLocalInput(editing.startsAt),
        endsAt: toLocalInput(editing.endsAt),
      }
    : BLANK;

  function close() {
    setCreating(false);
    setEditing(null);
  }

  function toggle(row: Announcement) {
    startTransition(async () => {
      const res = await setAnnouncementActiveAction(row.id, !row.isActive);
      if (res.success) {
        toast.success(row.isActive ? "Announcement hidden" : "Announcement is live");
        router.refresh();
      } else toast.error(res.error ?? "Could not update");
    });
  }

  function remove(row: Announcement) {
    startTransition(async () => {
      const res = await deleteAnnouncementAction(row.id);
      if (res.success) {
        toast.success("Announcement deleted");
        router.refresh();
      } else toast.error(res.error ?? "Could not delete");
    });
  }

  // Exactly what the public strip will render, minus scheduling.
  const livePreview = announcements
    .filter((a) => a.isActive)
    .map((a) => ({ id: a.id, message: a.message, linkLabel: a.linkLabel, linkHref: a.linkHref }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Active announcements scroll together as one marquee above the public header.
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus />
          New announcement
        </Button>
      </div>

      {/* Preview first: the point of this screen is what visitors will see. */}
      <div className="space-y-2">
        <p className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
          Live preview
        </p>
        {livePreview.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <OfferStrip announcements={livePreview} />
          </div>
        ) : (
          <Card variant="dashed" className="p-6 text-center">
            <p className="text-xs text-muted-foreground">
              Nothing active — the strip is hidden on the public site.
            </p>
          </Card>
        )}
      </div>

      {announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          description="Add one to run an offer, a launch note or a filing deadline reminder across the public site."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New announcement
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {announcements.map((row) => (
            <li key={row.id}>
              <Card variant="solid" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={row.isActive ? "success" : "neutral"} dot>
                      {row.isActive ? "Live" : "Hidden"}
                    </Badge>
                    <span className="text-2xs text-muted-foreground">order {row.sortOrder}</span>
                    {(row.startsAt || row.endsAt) && (
                      <span className="text-2xs text-muted-foreground">
                        {row.startsAt ? row.startsAt.toLocaleDateString("en-IN") : "—"} →{" "}
                        {row.endsAt ? row.endsAt.toLocaleDateString("en-IN") : "—"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-medium">{row.message}</p>
                  {row.linkHref && (
                    <p className="mt-0.5 font-mono text-2xs text-muted-foreground">
                      {row.linkLabel} → {row.linkHref}
                    </p>
                  )}
                </div>

                <div className="flex flex-shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => toggle(row)}
                    disabled={pending}
                    title={row.isActive ? "Hide from the site" : "Show on the site"}
                  >
                    {row.isActive ? <EyeOff /> : <Eye />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditing(row)}
                    title="Edit"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(row)}
                    disabled={pending}
                    title="Delete"
                    className="text-destructive-ink hover:bg-destructive/10"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <AnnouncementDialog
          initial={initial}
          id={editing?.id}
          onClose={close}
          onSaved={() => {
            close();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AnnouncementDialog({
  initial,
  id,
  onClose,
  onSaved,
}: {
  initial: AnnouncementInput;
  id?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AnnouncementInput>(initial);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof AnnouncementInput>(key: K, value: AnnouncementInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    setSaving(true);
    const res = await saveAnnouncementAction(form, id);
    setSaving(false);
    if (res.success) {
      toast.success(id ? "Announcement updated" : "Announcement created");
      onSaved();
    } else {
      toast.error(res.error ?? "Could not save");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      icon={<Megaphone className="size-4 text-primary-ink" aria-hidden />}
      title={id ? "Edit announcement" : "New announcement"}
      description="Shown in the scrolling strip above the public header."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={submit}>
            {id ? "Save changes" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <Field label="Message" htmlFor="ann-message" required hint="Keep it to one short line.">
          <Textarea
            id="ann-message"
            rows={2}
            maxLength={200}
            value={form.message}
            onChange={(e) => set("message", e.target.value)}
            placeholder="Diwali offer — 25% bonus credits on every recharge"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Link label" htmlFor="ann-label" hint="Leave both blank for no link.">
            <Input
              id="ann-label"
              value={form.linkLabel}
              onChange={(e) => set("linkLabel", e.target.value)}
              placeholder="See pricing"
            />
          </Field>
          <Field
            label="Link URL"
            htmlFor="ann-href"
            hint="An internal path like /pricing, or an https:// URL."
          >
            <Input
              id="ann-href"
              value={form.linkHref}
              onChange={(e) => set("linkHref", e.target.value)}
              placeholder="/pricing"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" htmlFor="ann-start" hint="Optional. Blank means immediately.">
            <Input
              id="ann-start"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
            />
          </Field>
          <Field label="Ends" htmlFor="ann-end" hint="Optional. Blank means no end date.">
            <Input
              id="ann-end"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => set("endsAt", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sort order" htmlFor="ann-order" hint="Lower numbers scroll first.">
            <Input
              id="ann-order"
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => set("sortOrder", Number(e.target.value))}
            />
          </Field>
          <Field label="Visibility" htmlFor="ann-active">
            <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
              <input
                id="ann-active"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
                className="size-4 accent-[hsl(var(--primary))]"
              />
              Show on the public site
            </label>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
