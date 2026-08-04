const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
const HSN_REGEX = /^\d{4,8}$/;

/**
 * Value Validator Engine:
 * Validates sample row values against expected field patterns.
 * Never relies on header names alone.
 */
export class ValueValidator {
  /** True when a column carries no data at all, so no header match should bind to it. */
  static isEmptyColumn(sampleValues: unknown[]): boolean {
    if (sampleValues.length === 0) return false;
    return sampleValues.every((v) => v === undefined || v === null || String(v).trim() === "");
  }

  static validateFieldValues(
    canonicalKey: string,
    sampleValues: unknown[]
  ): { isValid: boolean; passRate: number; reason: string } {
    const validSamples = sampleValues.filter(
      (v) => v !== undefined && v !== null && String(v).trim() !== ""
    );
    if (validSamples.length === 0) {
      return { isValid: true, passRate: 1, reason: "No sample data to evaluate" };
    }

    let passCount = 0;

    for (const val of validSamples) {
      const strVal = String(val).trim();

      switch (canonicalKey) {
        case "buyerGstin":
        case "ecoGstin": {
          if (GSTIN_REGEX.test(strVal)) passCount++;
          break;
        }
        case "hsnCode": {
          // Deliberately not stripping separators: "5/12/26" would otherwise clean up to a
          // plausible-looking 5-digit HSN and let date columns win the mapping.
          if (HSN_REGEX.test(strVal)) passCount++;
          break;
        }
        case "taxableValue":
        case "cgstAmount":
        case "sgstAmount":
        case "igstAmount":
        case "cessAmount": {
          const cleanNum = strVal.replace(/[^0-9.-]/g, "");
          if (!isNaN(Number(cleanNum)) && cleanNum !== "") passCount++;
          break;
        }
        case "cgstRate":
        case "sgstRate":
        case "igstRate": {
          const num = Number(strVal.replace(/[^0-9.]/g, ""));
          if (!isNaN(num) && num >= 0 && num <= 28) passCount++;
          break;
        }
        case "placeOfSupply": {
          const cleanPos = strVal.replace(/[^0-9]/g, "");
          if (cleanPos.length === 2 || (Number(cleanPos) >= 1 && Number(cleanPos) <= 99))
            passCount++;
          break;
        }
        case "buyerName":
        case "ecoName": {
          // Marketplace exports put the buyer's name and GSTIN in adjacent columns whose headers
          // share a word ("Customer Name" / "Customer Bill To Gstid"), so a name field will bind
          // to the GSTIN column unless the values themselves are checked. A name is also never a
          // bare number, which rules out ids and amounts.
          if (GSTIN_REGEX.test(strVal)) break;
          if (/^[\d\s.,-]+$/.test(strVal)) break;
          passCount++;
          break;
        }
        default: {
          if (strVal.length > 0) passCount++;
          break;
        }
      }
    }

    const passRate = passCount / validSamples.length;
    const isValid = passRate >= 0.5; // At least 50% pass rate on non-empty sample values

    return {
      isValid,
      passRate: Math.round(passRate * 100) / 100,
      reason: isValid
        ? `Passed value pattern check (${Math.round(passRate * 100)}% valid sample rows)`
        : `Sample values failed value validation (${Math.round(passRate * 100)}% valid sample rows)`,
    };
  }
}
