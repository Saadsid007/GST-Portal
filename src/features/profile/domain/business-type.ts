import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  Building2,
  Factory,
  Landmark,
  ShoppingBag,
  Store,
  Truck,
  Wrench,
} from "lucide-react";

/**
 * Nature of business on a GSTIN profile.
 *
 * Stored as a plain string so adding a category is a data change rather than a
 * migration. These are the shapes that actually behave differently when filing
 * marketplace GST — a CA firm filing for clients has different needs from a
 * single D2C brand, and a manufacturer's HSN mix looks nothing like a
 * reseller's.
 */
export const BUSINESS_TYPES = [
  "ECOMMERCE_SELLER",
  "D2C_BRAND",
  "TRADER",
  "RETAILER",
  "MANUFACTURER",
  "SERVICE_PROVIDER",
  "CA_FIRM",
  "OTHER",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export interface BusinessTypeMeta {
  value: BusinessType;
  label: string;
  hint: string;
  icon: LucideIcon;
}

export const BUSINESS_TYPE_META: Record<BusinessType, BusinessTypeMeta> = {
  ECOMMERCE_SELLER: {
    value: "ECOMMERCE_SELLER",
    label: "E-commerce seller",
    hint: "Sells on Amazon, Flipkart, Meesho and similar marketplaces.",
    icon: ShoppingBag,
  },
  D2C_BRAND: {
    value: "D2C_BRAND",
    label: "D2C brand",
    hint: "Own website or Shopify store, sometimes alongside marketplaces.",
    icon: Store,
  },
  TRADER: {
    value: "TRADER",
    label: "Trader / wholesaler",
    hint: "Buys and resells in bulk, largely B2B invoicing.",
    icon: Boxes,
  },
  RETAILER: {
    value: "RETAILER",
    label: "Retailer",
    hint: "Physical shop or counter sales, mostly B2C.",
    icon: Building2,
  },
  MANUFACTURER: {
    value: "MANUFACTURER",
    label: "Manufacturer",
    hint: "Produces goods; typically a narrow, stable HSN set.",
    icon: Factory,
  },
  SERVICE_PROVIDER: {
    value: "SERVICE_PROVIDER",
    label: "Service provider",
    hint: "Services rather than goods; SAC codes instead of HSN.",
    icon: Wrench,
  },
  CA_FIRM: {
    value: "CA_FIRM",
    label: "CA / tax practice",
    hint: "Files on behalf of clients across several GSTINs.",
    icon: Landmark,
  },
  OTHER: {
    value: "OTHER",
    label: "Other",
    hint: "Anything not covered above.",
    icon: Truck,
  },
};

/** Ordered list for pickers. */
export const BUSINESS_TYPE_OPTIONS: BusinessTypeMeta[] = BUSINESS_TYPES.map(
  (t) => BUSINESS_TYPE_META[t]
);

export function isBusinessType(value: string): value is BusinessType {
  return (BUSINESS_TYPES as readonly string[]).includes(value);
}

/** Falls back rather than throwing — a legacy row must still render. */
export function businessTypeMeta(value: string): BusinessTypeMeta {
  return isBusinessType(value) ? BUSINESS_TYPE_META[value] : BUSINESS_TYPE_META.OTHER;
}

/**
 * Categories present in a set of profiles, in canonical order, each with a
 * count. Drives the filter chips — a category nobody uses should not occupy a
 * chip, and the counts tell the user what filtering will do before they click.
 */
export function businessTypeFacets<T extends { businessType?: string }>(
  profiles: T[]
): { meta: BusinessTypeMeta; count: number }[] {
  const counts = new Map<BusinessType, number>();
  for (const p of profiles) {
    const key = businessTypeMeta(p.businessType || "").value;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return BUSINESS_TYPES.filter((t) => counts.has(t)).map((t) => ({
    meta: BUSINESS_TYPE_META[t],
    count: counts.get(t) ?? 0,
  }));
}
