import type { ColumnMappingDict } from "./mapping.templates";

/**
 * Self-Learning Mapping Memory:
 * Hashes header signatures and provides utility functions for persistent mapping profiles.
 * Safe for client and server execution.
 */
export class MappingMemoryService {
  static computeHeaderSignature(headers: string[]): string {
    const norm = headers
      .map((h) =>
        String(h || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
      )
      .sort()
      .join("|");
    return norm;
  }

  static findSavedMappingInMemory(
    savedProfiles: { platformId: string; mappings: unknown }[],
    platformId: string
  ): ColumnMappingDict | null {
    const profile = savedProfiles.find((p) => p.platformId === platformId);
    if (profile && profile.mappings) {
      return profile.mappings as ColumnMappingDict;
    }
    return null;
  }
}
