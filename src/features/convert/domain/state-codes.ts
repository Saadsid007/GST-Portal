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
  "37": "Andhra Pradesh (New)",
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

  // Match by state name
  const lower = str.toLowerCase();
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
