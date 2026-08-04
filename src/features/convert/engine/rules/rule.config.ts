export interface PlatformRuleConfig {
  platformId: string;
  requiredFileTypes: string[];
  optionalFileTypes: string[];
  creditNoteClassification: "auto" | "explicit_cdnr_only" | "b2cs_adjustment_preferred";
  allowZeroTaxableValue: boolean;
  defaultHsnCode: string;
  duplicatePolicy: "warn" | "reject" | "merge";
}

export const PLATFORM_RULES: Record<string, PlatformRuleConfig> = {
  amazon: {
    platformId: "amazon",
    requiredFileTypes: ["b2b"],
    optionalFileTypes: ["b2c", "credit_notes"],
    creditNoteClassification: "auto",
    allowZeroTaxableValue: false,
    defaultHsnCode: "998313",
    duplicatePolicy: "warn",
  },
  meesho: {
    platformId: "meesho",
    requiredFileTypes: ["sales", "returns"],
    optionalFileTypes: ["tax_invoice"],
    creditNoteClassification: "auto",
    allowZeroTaxableValue: false,
    defaultHsnCode: "998313",
    duplicatePolicy: "warn",
  },
  flipkart: {
    platformId: "flipkart",
    requiredFileTypes: ["sales"],
    optionalFileTypes: ["returns"],
    creditNoteClassification: "auto",
    allowZeroTaxableValue: false,
    defaultHsnCode: "998313",
    duplicatePolicy: "warn",
  },
  custom: {
    platformId: "custom",
    requiredFileTypes: ["custom_file"],
    optionalFileTypes: [],
    creditNoteClassification: "auto",
    allowZeroTaxableValue: false,
    defaultHsnCode: "998313",
    duplicatePolicy: "warn",
  },
};

export function getPlatformRule(platformId: string): PlatformRuleConfig {
  return (
    PLATFORM_RULES[platformId] ?? {
      platformId,
      requiredFileTypes: ["sales"],
      optionalFileTypes: [],
      creditNoteClassification: "auto",
      allowZeroTaxableValue: false,
      defaultHsnCode: "998313",
      duplicatePolicy: "warn",
    }
  );
}
