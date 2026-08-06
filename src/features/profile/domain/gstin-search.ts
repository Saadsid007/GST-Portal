export interface SearchableProfile {
  gstinNumber: string;
  legalName: string;
  tradeName?: string | null;
  stateCode: string;
  stateName: string;
  isDefault?: boolean;
}

/**
 * Shared by the profile manager and the converter's step 1, so "search" means
 * the same thing in both places.
 *
 * Matching is deliberately forgiving about how people actually type a GSTIN:
 * they paste it with spaces, or type the last few digits from memory, or search
 * by the state they are filing for. Every term must match something, so
 * "karnataka nova" narrows rather than widens.
 */
export function matchesGstinQuery(profile: SearchableProfile, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  // GSTINs get pasted with spaces and hyphens; compare against a stripped form.
  const compactGstin = profile.gstinNumber.toLowerCase().replace(/[\s-]/g, "");

  const haystacks = [
    compactGstin,
    profile.legalName.toLowerCase(),
    (profile.tradeName ?? "").toLowerCase(),
    profile.stateName.toLowerCase(),
    profile.stateCode.toLowerCase(),
  ];

  return terms.every((term) => {
    const compactTerm = term.replace(/[\s-]/g, "");
    return haystacks.some((h) => h.includes(term)) || compactGstin.includes(compactTerm);
  });
}

/** Filters, keeping the default profile first so it stays easy to reach. */
export function filterGstinProfiles<T extends SearchableProfile>(
  profiles: T[],
  query: string
): T[] {
  return profiles
    .filter((p) => matchesGstinQuery(p, query))
    .sort((a, b) => Number(b.isDefault ?? false) - Number(a.isDefault ?? false));
}
