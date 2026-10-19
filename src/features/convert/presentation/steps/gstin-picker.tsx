"use client";

import { useMemo, useState } from "react";
import type { GstinProfile } from "@/generated/prisma/client";
import { filterGstinProfiles } from "@/features/profile/domain/gstin-search";
import {
  businessTypeFacets,
  businessTypeMeta,
  type BusinessType,
} from "@/features/profile/domain/business-type";
import { Button, EmptyState, Input } from "@/components/ui";
import { Building2, Check, Search, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  profiles: GstinProfile[];
  value: string;
  onChange: (gstinNumber: string) => void;
  /** Enter on a single result, or a double-click: choose and move on. */
  onConfirm?: () => void;
}

/** Search appears from two profiles up. At one it would be pure noise. */
const SEARCH_THRESHOLD = 2;

/**
 * Choosing the GSTIN to file for, from one profile to a CA firm's two hundred.
 *
 * Search by GSTIN, name or state, narrow by business type, arrow keys and
 * Enter. Rows rather than cards, in a box that scrolls on its own, so a long
 * list neither pushes the rest of the screen away nor breaks on a phone.
 */
export function GstinPicker({ profiles, value, onChange, onConfirm }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [category, setCategory] = useState<BusinessType | "ALL">("ALL");

  const showSearch = profiles.length >= SEARCH_THRESHOLD;

  // Facets come from the profiles themselves, so a category nobody uses never
  // occupies a chip and the counts tell you what a click will do beforehand.
  const facets = useMemo(
    () => businessTypeFacets(profiles as unknown as { businessType?: string }[]),
    [profiles]
  );
  const showCategories = facets.length > 1;

  const filtered = useMemo(() => {
    const byCategory =
      category === "ALL"
        ? profiles
        : profiles.filter(
            (p) =>
              businessTypeMeta((p as unknown as { businessType?: string }).businessType || "")
                .value === category
          );
    return filterGstinProfiles(byCategory, query);
  }, [profiles, query, category]);

  const selected = profiles.find((p) => p.gstinNumber === value);
  // A filtered-out selection must still be visible, or it looks like nothing
  // is chosen while Continue stays enabled.
  const selectedIsHidden = Boolean(selected) && !filtered.some((p) => p.id === selected?.id);

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (filtered.length === 0 ? 0 : (c + 1) % filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (filtered.length === 0 ? 0 : (c - 1 + filtered.length) % filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[cursor];
      if (target) {
        onChange(target.gstinNumber);
        // Narrowing to one result then hitting Enter is the fast path.
        if (filtered.length === 1) onConfirm?.();
      }
    } else if (e.key === "Escape" && query) {
      e.preventDefault();
      setQuery("");
    }
  }

  return (
    <div className="space-y-2.5">
      {showSearch && (
        <>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onSearchKeyDown}
            placeholder="Search by GSTIN, business name or state…"
            aria-label="Search GST profiles"
            prefixNode={<Search />}
            suffixNode={
              query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="rounded p-0.5 hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : undefined
            }
          />
          {showCategories && (
            <div className="-mx-1 scrollbar-none flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              <CategoryChip
                label="All"
                count={profiles.length}
                active={category === "ALL"}
                onClick={() => {
                  setCategory("ALL");
                  setCursor(0);
                }}
              />
              {facets.map(({ meta, count }) => (
                <CategoryChip
                  key={meta.value}
                  label={meta.label}
                  count={count}
                  icon={<meta.icon className="size-3" aria-hidden />}
                  active={category === meta.value}
                  onClick={() => {
                    setCategory(meta.value);
                    setCursor(0);
                  }}
                />
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-2xs text-muted-foreground">
            <span>
              Showing {filtered.length} of {profiles.length}
            </span>
            <span className="hidden sm:inline">↑↓ to move · ↵ to select</span>
          </div>
        </>
      )}

      {selectedIsHidden && selected && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-xs">
          <Check className="size-3.5 flex-shrink-0 text-primary-ink" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            Selected: <span className="font-semibold">{selected.legalName}</span>{" "}
            <span className="font-mono text-muted-foreground">{selected.gstinNumber}</span>
          </span>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="flex-shrink-0 font-semibold text-primary-ink hover:underline"
          >
            Show
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching GST profile"
          description={`Nothing matches “${query}”. Try the GSTIN, the business name, or the state.`}
          action={
            <Button variant="outline" size="sm" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div
          role="listbox"
          aria-label="GST profiles"
          className="max-h-[19rem] divide-y divide-border overflow-y-auto overscroll-contain rounded-xl border border-border"
        >
          {filtered.map((p, i) => {
            const isSelected = value === p.gstinNumber;
            const isCursor = showSearch && query.length > 0 && i === cursor;
            return (
              <button
                type="button"
                key={p.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => onChange(p.gstinNumber)}
                onDoubleClick={() => {
                  onChange(p.gstinNumber);
                  onConfirm?.();
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                  isSelected ? "bg-primary/10" : "hover:bg-accent/60",
                  isCursor && !isSelected && "bg-accent/60"
                )}
              >
                <span
                  className={cn(
                    "flex size-8 flex-shrink-0 items-center justify-center rounded-lg",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Building2 className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">
                      {p.tradeName || p.legalName}
                    </span>
                    {p.isDefault && (
                      <Star
                        className="size-3 flex-shrink-0 fill-warning text-warning"
                        aria-label="Default profile"
                      />
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 text-2xs text-muted-foreground">
                    <span className="font-mono">{p.gstinNumber}</span>
                    <span>{p.stateName}</span>
                  </span>
                </span>
                {isSelected && (
                  <Check className="size-4 flex-shrink-0 text-primary-ink" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  count,
  icon,
  active,
  onClick,
}: {
  label: string;
  count: number;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-2xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary-ink"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
      <span className={cn("tabular-nums", active ? "opacity-80" : "opacity-60")}>{count}</span>
    </button>
  );
}
