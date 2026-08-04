import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";

export interface DetectionResult {
  platformId: string;
  platformName: string;
  fileTypeId: string;
  parserVersion: string;
  confidence: number; // 0 to 100
  matchedKeywords: string[];
}

function sanitize(str: string): string {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Auto Platform & Report Type Detector:
 * Analyzes raw headers, sheet names, and file patterns to automatically identify the marketplace,
 * report slot, parser version, and confidence score.
 */
export class PlatformDetector {
  static detect(headers: string[], sheetName?: string, fileName?: string): DetectionResult {
    const normHeaders = headers.map((h) => sanitize(h));
    const normSheet = sanitize(sheetName || "");
    const normFile = sanitize(fileName || "");

    let bestMatch: DetectionResult = {
      platformId: "custom",
      platformName: "Custom Excel",
      fileTypeId: "custom_file",
      parserVersion: "v1",
      confidence: 30,
      matchedKeywords: [],
    };

    let highestScore = 0;

    for (const plat of PLATFORMS_CONFIG) {
      for (const fileSlot of plat.files) {
        let score = 0;
        const matchedKeywords: string[] = [];

        // 1. File name match
        if (normFile.includes(sanitize(plat.id)) || normFile.includes(sanitize(plat.name))) {
          score += 25;
          matchedKeywords.push(`File: ${plat.name}`);
        }

        // 2. Sheet name match
        if (
          normSheet.includes(sanitize(fileSlot.id)) ||
          normSheet.includes(sanitize(fileSlot.name))
        ) {
          score += 20;
          matchedKeywords.push(`Sheet: ${fileSlot.name}`);
        }

        // 3. Header keyword matches
        if (fileSlot.headerKeywords) {
          for (const kw of fileSlot.headerKeywords) {
            const sanitizedKw = sanitize(kw);
            const found = normHeaders.some((h) => h.includes(sanitizedKw));
            if (found) {
              score += 15;
              matchedKeywords.push(`Header: ${kw}`);
            }
          }
        }

        if (score > highestScore) {
          highestScore = score;
          const confidence = Math.min(Math.max(score, 40), 99);
          bestMatch = {
            platformId: plat.id,
            platformName: plat.name,
            fileTypeId: fileSlot.id,
            parserVersion: plat.id === "amazon" ? "v3" : "v2",
            confidence,
            matchedKeywords,
          };
        }
      }
    }

    return bestMatch;
  }
}
