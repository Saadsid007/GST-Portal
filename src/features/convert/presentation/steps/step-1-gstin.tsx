"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { GstinProfile } from "@/generated/prisma/client";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import { filterGstinProfiles } from "@/features/profile/domain/gstin-search";
import { Badge, Button, EmptyState, Input } from "@/components/ui";
import { Building2, ArrowRight, Check, Plus, Search, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  state: MultiConvertState;
  profiles: GstinProfile[];
  onChange: (updates: Partial<MultiConvertState>) => void;
  onNext: () => void;
}

/** Below this the list is scannable at a glance and a search box is just noise. */
/** Search appears from two profiles up. At one it would be pure noise. */
const SEARCH_THRESHOLD = 2;

export function Step1Gstin({ state, profiles, onChange, onNext }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const showSearch = profiles.length >= SEARCH_THRESHOLD;
  const filtered = useMemo(() => filterGstinProfiles(profiles, query), [profiles, query]);

  const selected = profiles.find((p) => p.gstinNumber === state.gstinNumber);
  // A filtered-out selection must still be visible, or it looks like nothing is
  // chosen while Next stays enabled.
  const selectedIsHidden = Boolean(selected) && !filtered.some((p) => p.id === selected?.id);

  function choose(gstinNumber: string) {
    onChange({ gstinNumber });
  }

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
        choose(target.gstinNumber);
        // Narrowing to one result then hitting Enter is the fast path.
        if (filtered.length === 1) onNext();
      }
    } else if (e.key === "Escape" && query) {
      e.preventDefault();
      setQuery("");
    }
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge variant="primary">Step 1 of 10</Badge>
          <h2 className="mt-2 text-xl font-bold">Select GST profile</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Choose the registered GSTIN this GSTR-1 return is for.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
          <Link href="/profile">
            <Plus />
            Add GSTIN
          </Link>
        </Button>
      </div>

      {showSearch && (
        <div className="space-y-2">
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
          <div className="flex items-center justify-between text-2xs text-muted-foreground">
            <span>
              Showing {filtered.length} of {profiles.length} profiles
            </span>
            <span className="hidden sm:inline">↑↓ to move · ↵ to select</span>
          </div>
        </div>
      )}

      {/* Keeps the chosen profile on screen when the search filters it out. */}
      {selectedIsHidden && selected && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-xs">
          <Check className="size-3.5 flex-shrink-0 text-primary-ink" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            Currently selected: <span className="font-semibold">{selected.legalName}</span>{" "}
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
          className={cn(
            "grid grid-cols-1 gap-3 md:grid-cols-2",
            // Long lists scroll inside the step rather than pushing Next off screen.
            filtered.length > 6 && "scrollbar-none max-h-[26rem] overflow-y-auto pr-1"
          )}
        >
          {filtered.map((p, i) => {
            const isSelected = state.gstinNumber === p.gstinNumber;
            const isCursor = showSearch && query.length > 0 && i === cursor;
            return (
              <button
                type="button"
                key={p.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => choose(p.gstinNumber)}
                onDoubleClick={() => {
                  choose(p.gstinNumber);
                  onNext();
                }}
                className={cn(
                  "relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-200",
                  isSelected
                    ? "border-primary bg-primary/[0.06] shadow-sm ring-2 ring-primary/20"
                    : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
                  isCursor && !isSelected && "border-primary/50 bg-accent/40"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 left-0 w-0.5 bg-primary transition-opacity",
                    isSelected ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex size-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Building2 className="size-4" aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold">{p.legalName}</p>
                      {p.isDefault && (
                        <Star
                          className="size-3 flex-shrink-0 fill-warning text-warning"
                          aria-label="Default profile"
                        />
                      )}
                    </div>
                    {p.tradeName && (
                      <p className="truncate text-2xs text-muted-foreground">{p.tradeName}</p>
                    )}
                    <p className="mt-1 truncate font-mono text-2xs text-muted-foreground">
                      {p.gstinNumber}
                    </p>
                  </div>

                  {isSelected && (
                    <Check className="size-4 flex-shrink-0 text-primary-ink" aria-hidden />
                  )}
                </div>

                <div className="mt-3 border-t border-border/60 pt-2">
                  <Badge variant="neutral">
                    {p.stateName} ({p.stateCode})
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-2xs text-muted-foreground">
          {selected ? (
            <>
              Filing for <span className="font-semibold text-foreground">{selected.legalName}</span>
            </>
          ) : (
            "Select a profile to continue"
          )}
        </p>
        <Button
          variant="brand"
          size="lg"
          onClick={onNext}
          disabled={!state.gstinNumber}
          className="w-full sm:w-auto"
        >
          Next: return filing period
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
