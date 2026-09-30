/**
 * The e-commerce operator a marketplace supply was collected through, for
 * GSTR-1 Table 14(a).
 *
 * Resolution, highest authority first:
 * 1. A GSTIN the user saved for the platform — when it is the operator's.
 * 2. The operator GSTIN printed in the uploaded report itself.
 * 3. The operator's TCS registration in the seller's state, derived below.
 *
 * Table 14 needs the operator's registration as a tax collector under
 * section 52, and that registration is not a number to be looked up in a
 * hand-kept table. It is the state code, the operator's PAN, the entity
 * number, "C", and a check digit — and the check digit is computed, not
 * chosen. The table this replaces had 36 of its 76 numbers failing their own
 * check digit, swapped Amazon's and Meesho's PANs in Uttar Pradesh, and gave
 * every Flipkart seller the GSTIN of Flipkart India — the wholesale company,
 * which collects no TCS — instead of Flipkart Internet, the marketplace.
 *
 * Each PAN below is confirmed against a return a CA filed through the portal
 * or against the operator's own export, and the rule reproduces every real
 * operator GSTIN those carry: 27AACCF0683K1CS (Flipkart), 27AAICA3918J1CT
 * and 29AAICA3918J1CP (Amazon), 09AARCM9332R1CM (Meesho).
 */

export interface ResolveEcoOptions {
  platformId: string;
  supplierGstin?: string;
  userFallbackGstin?: string;
  rowGstin?: string;
}

export interface EcoResolutionResult {
  ecoGstin: string;
  ecoName: string;
  status: "VERIFIED" | "USER_OVERRIDE" | "FILE_EXTRACTED" | "VERIFY_REQUIRED";
  source: string;
  isReliable: boolean;
}

interface Operator {
  legalName: string;
  /** Every PAN the operator collects TCS under. The first is the one derived from. */
  pans: string[];
  /**
   * States where the register shows this PAN holding a TCS registration.
   * Outside them a derived number is only a best guess, and is said to be.
   */
  confirmedStates?: ReadonlySet<string>;
}

/** Amazon's TCS registrations, as the public register listed them in April 2026. */
const AMAZON_TCS_STATES = new Set([
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "26",
  "27",
  "29",
  "30",
  "32",
  "33",
  "34",
  "36",
  "37",
]);

const OPERATORS: Record<string, Operator> = {
  amazon: {
    legalName: "Amazon Seller Services Private Limited",
    pans: ["AAICA3918J"],
    confirmedStates: AMAZON_TCS_STATES,
  },
  flipkart: {
    legalName: "Flipkart Internet Private Limited",
    pans: ["AACCF0683K"],
    confirmedStates: new Set(["09", "27"]),
  },
  meesho: {
    legalName: "Meesho Limited",
    pans: ["AARCM9332R"],
    confirmedStates: new Set(["09"]),
  },
};

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{1}[0-9A-Z]{1}$/;
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function checkDigit(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = ALPHABET.indexOf(first14[i]!) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return ALPHABET[(36 - (sum % 36)) % 36]!;
}

export function isValidGstin(gstin?: string): boolean {
  if (!gstin) return false;
  const cleaned = gstin.trim().toUpperCase();
  return GSTIN_REGEX.test(cleaned) && checkDigit(cleaned.slice(0, 14)) === cleaned[14];
}

/**
 * The same registration's tax-collector form: "C" in the 14th place, and the
 * check digit that goes with it. Setting the "C" alone left a number whose
 * last character no longer matched — a GSTIN that exists nowhere.
 */
export function ensureTcsGstin(gstin: string): string {
  const cleaned = gstin.trim().toUpperCase();
  if (!GSTIN_REGEX.test(cleaned)) return cleaned;
  const first14 = `${cleaned.slice(0, 13)}C`;
  return first14 + checkDigit(first14);
}

/** Whether a GSTIN belongs to the operator — not to some other business. */
function belongsTo(operator: Operator | undefined, gstin: string): boolean {
  if (!operator) return true;
  return operator.pans.includes(gstin.trim().toUpperCase().slice(2, 12));
}

export function resolveEcoGstin(options: ResolveEcoOptions): EcoResolutionResult {
  const { platformId, supplierGstin, userFallbackGstin, rowGstin } = options;
  const platform = platformId.toLowerCase();
  const operator = OPERATORS[platform];
  const legalName = operator?.legalName ?? "E-Commerce Operator";

  // A saved value is taken only when it is the operator's. Values were saved
  // automatically from earlier conversions, which filled Flipkart's from the
  // old table — Flipkart India's number — and a saved value outranks
  // everything, so without this check the wrong company would stick for good.
  if (
    userFallbackGstin &&
    isValidGstin(ensureTcsGstin(userFallbackGstin)) &&
    belongsTo(operator, userFallbackGstin)
  ) {
    return {
      ecoGstin: ensureTcsGstin(userFallbackGstin),
      ecoName: legalName,
      status: "USER_OVERRIDE",
      source: "User Workspace Settings",
      isReliable: true,
    };
  }

  // The report's own word on who collected the tax.
  if (rowGstin && GSTIN_REGEX.test(rowGstin.trim().toUpperCase())) {
    return {
      ecoGstin: ensureTcsGstin(rowGstin),
      ecoName: legalName,
      status: "FILE_EXTRACTED",
      source: "Uploaded Report File",
      isReliable: true,
    };
  }

  // Derived for the seller's state. An operator we do not know gets nothing
  // rather than another operator's number.
  const state = supplierGstin?.slice(0, 2) ?? "";
  if (!operator || !/^\d{2}$/.test(state)) {
    return {
      ecoGstin: "",
      ecoName: legalName,
      status: "VERIFY_REQUIRED",
      source: "No operator registration known",
      isReliable: false,
    };
  }

  const confirmed = operator.confirmedStates?.has(state) ?? false;
  return {
    ecoGstin: ensureTcsGstin(`${state}${operator.pans[0]}1C0`),
    ecoName: legalName,
    status: confirmed ? "VERIFIED" : "VERIFY_REQUIRED",
    source: confirmed
      ? "Operator TCS registration, confirmed on the register"
      : "Operator TCS registration, derived from its PAN",
    isReliable: confirmed,
  };
}
