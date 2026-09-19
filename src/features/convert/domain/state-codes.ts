export interface StateMapping {
  code: string;
  name: string;
}

export const STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  // Daman & Diu (25) and Dadra & Nagar Haveli (26) merged into one union
  // territory on 26 January 2020 and the portal retired code 25. It is still
  // accepted as input — old GSTINs and older files carry it — but it is never
  // emitted; see MERGED_UT_CODE.
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
  "96": "Foreign Country",
};

/** The retired Daman & Diu code, and what it became. */
const RETIRED_DAMAN_DIU = "25";
const MERGED_UT_CODE = "26";

/**
 * Applies the 2020 union-territory merger to whatever code was resolved.
 *
 * Every path out of normalizeStateCode goes through this. The remap used to
 * sit at the top and only caught a bare "25", so a state *name* and a GSTIN
 * beginning 25 both came out as the retired code — and a Meesho export writes
 * the name. Table 7 then carried a place of supply the portal no longer
 * accepts, against a filed return that used 26.
 */
function canonical(code: string): string {
  return code === RETIRED_DAMAN_DIU ? MERGED_UT_CODE : code;
}

/**
 * Normalizes state input (code or state name or GSTIN prefix) into a valid 2-digit state code.
 */
export function normalizeStateCode(input: unknown): string {
  if (!input) return "";
  const str = String(input).trim();
  if (!str) return "";

  // If already 2 digit code
  if (/^\d{2}$/.exec(str) && (STATE_CODES[str] || str === RETIRED_DAMAN_DIU)) {
    return canonical(str);
  }

  // If 1 digit, pad with leading zero e.g. "7" -> "07"
  if (/^\d{1}$/.exec(str)) {
    const padded = `0${str}`;
    if (STATE_CODES[padded]) return padded;
  }

  // Check GSTIN pattern e.g. 27AAAAA0000A1Z5
  if (str.length >= 2 && /^\d{2}/.exec(str)) {
    const prefix = str.substring(0, 2);
    if (STATE_CODES[prefix] || prefix === RETIRED_DAMAN_DIU) return canonical(prefix);
  }

  const lower = str.toLowerCase();

  // Marketplace alias table — spellings that don't fuzzy-match the canonical name
  // (e.g. AND vs &, single-t Chattisgarh, UT abbreviations, etc.)
  const ALIASES: Record<string, string> = {
    // J&K variants
    "jammu and kashmir": "01",
    "jammu & kashmir": "01",
    "j&k": "01",
    jk: "01",
    // Chhattisgarh common misspelling
    chattisgarh: "22",
    chhattisgarh: "22",
    chhatisgarh: "22",
    // Andaman
    "andaman and nicobar islands": "35",
    "andaman & nicobar islands": "35",
    "andaman nicobar islands": "35",
    // Puducherry / Pondicherry
    pondicherry: "34",
    puducherry: "34",
    // Odisha / Orissa
    odisha: "21",
    orissa: "21",
    // Uttarakhand
    uttarakhand: "05",
    uttaranchal: "05",
    // Delhi
    delhi: "07",
    "new delhi": "07",
    // The merged union territory. Meesho writes the full name, which matched
    // nothing and then fell through to a substring match on "Daman & Diu".
    "dadra and nagar haveli and daman and diu": "26",
    "dadra & nagar haveli and daman & diu": "26",
    "dadra and nagar haveli & daman and diu": "26",
    "dadra & nagar haveli & daman & diu": "26",
    // Either half on its own, from before the merger.
    "daman and diu": "26",
    "daman & diu": "26",
    "dadra and nagar haveli": "26",
    "dadra & nagar haveli": "26",
    "dadra nagar haveli": "26",
    // Ladakh
    ladakh: "38",
    // Andhra Pradesh
    "andhra pradesh": "37",
    ap: "37",
    // Telangana
    telangana: "36",
    // Other
    "other territory": "97",
    "foreign country": "96",
    export: "96",
  };

  if (ALIASES[lower]) return canonical(ALIASES[lower]);

  // Match by state name, longest name first.
  //
  // First-match-wins compared against whichever key came earliest, so
  // "Dadra & Nagar Haveli and Daman & Diu" matched the shorter "Daman & Diu"
  // sitting above it and resolved to the wrong territory. The longest name
  // that fits is the most specific one.
  const byLength = Object.entries(STATE_CODES).sort((a, b) => b[1].length - a[1].length);
  for (const [code, name] of byLength) {
    const candidate = name.toLowerCase();
    if (candidate === lower || candidate.includes(lower) || lower.includes(candidate)) {
      return canonical(code);
    }
  }

  return "";
}

/**
 * Helper to get State Name from 2-digit code.
 */
export function getStateName(stateCode: string): string {
  return STATE_CODES[stateCode] ?? "Unknown State";
}
