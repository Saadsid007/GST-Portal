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
  "25": "Daman & Diu",
  "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
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

/**
 * Normalizes state input (code or state name or GSTIN prefix) into a valid 2-digit state code.
 */
export function normalizeStateCode(input: unknown): string {
  if (!input) return "";
  const str = String(input).trim();
  if (!str) return "";

  // If already 2 digit code
  if (/^\d{2}$/.exec(str) && STATE_CODES[str]) {
    return str;
  }

  // If 1 digit, pad with leading zero e.g. "7" -> "07"
  if (/^\d{1}$/.exec(str)) {
    const padded = `0${str}`;
    if (STATE_CODES[padded]) return padded;
  }

  // Check GSTIN pattern e.g. 27AAAAA0000A1Z5
  if (str.length >= 2 && /^\d{2}/.exec(str)) {
    const prefix = str.substring(0, 2);
    if (STATE_CODES[prefix]) return prefix;
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
    // Daman & Diu
    "daman and diu": "25",
    "daman & diu": "25",
    // Dadra & Nagar Haveli
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

  if (ALIASES[lower]) return ALIASES[lower];

  // Match by state name
  for (const [code, name] of Object.entries(STATE_CODES)) {
    if (
      name.toLowerCase() === lower ||
      name.toLowerCase().includes(lower) ||
      lower.includes(name.toLowerCase())
    ) {
      return code;
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
