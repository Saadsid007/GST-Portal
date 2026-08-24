/**
 * Centralized Pricing & Subscription Configuration for GSTPilot
 * Single authoritative source of truth for plans, pricing, feature flags, GSTIN capacity, and add-on rates.
 */

export type PlanSlug = "free_trial" | "starter" | "growth" | "business" | "ca_pro" | "ca_firm";

export interface PlanCapabilities {
  marketplaceImports: boolean;
  gstr1Excel: boolean;
  gstr1Json: boolean;
  validationEngine: boolean;
  errorCenter: boolean;
  hsnSummary: boolean;
  ecoTable14: boolean;
  basicReconciliation: boolean;
  advancedReconciliation: boolean;
  aiCorrections: boolean;
  gstr1Comparison: boolean;
  bulkProcessing: boolean;
  advancedAuditReports: boolean;
  teamMembers: boolean;
  bulkClientProcessing: boolean;
  zipDownloads: boolean;
  clientManagement: boolean;
  advancedAiReview: boolean;
  firmLevelReporting: boolean;
  whiteLabel: boolean;
  firmBranding: boolean;
  clientPortal: boolean;
  advancedAnalytics: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

export interface PlanDefinition {
  slug: PlanSlug;
  name: string;
  monthlyPrice: number;
  currency: string;
  includedGSTINs: number;
  durationDays: number;
  badge?: string;
  isPopular?: boolean;
  description: string;
  features: string[];
  capabilities: PlanCapabilities;
}

export const FREE_TRIAL_DURATION_DAYS = 30;
export const FREE_TRIAL_GSTIN_LIMIT = 7;
export const ADDITIONAL_GSTIN_PRICE_MONTHLY = 6;
export const MIN_GSTIN_ADDON_PACK = 1;

/**
 * Anti-abuse limits for GSTIN capacity, centralized so no threshold is ever
 * hardcoded in a service or a UI component. Tuned to stay invisible to normal
 * CA/business workflows and to bite only on high-frequency churn.
 */
export const GSTIN_ANTI_ABUSE = {
  /**
   * Extra brand-new GSTIN activations allowed per billing period beyond total
   * capacity. Covers legitimate client replacement (a client leaves, another
   * joins) without an upgrade, while still bounding create-and-recreate cycles.
   * Restoring a GSTIN already activated this period does not count against it.
   */
  replacementAllowancePerCycle: 5,
  /**
   * Ceiling on capacity-changing operations (activate / archive / restore) in a
   * trailing one-hour window. Beyond this the operation is rate-limited and an
   * admin-review event is raised — the user is never auto-banned.
   */
  maxCapacityOpsPerHour: 30,
  /** Width of the churn window in milliseconds. */
  churnWindowMs: 60 * 60 * 1000,
} as const;

export const PLANS: Record<PlanSlug, PlanDefinition> = {
  free_trial: {
    slug: "free_trial",
    name: "30-Day Free Trial",
    monthlyPrice: 0,
    currency: "INR",
    includedGSTINs: FREE_TRIAL_GSTIN_LIMIT,
    durationDays: FREE_TRIAL_DURATION_DAYS,
    description: "Full access to test unlimited GSTR-1 generation across 7 GSTINs",
    features: [
      "7 GSTIN client capacity",
      "Unlimited GSTR-1 generations",
      "All marketplace imports (Amazon, Meesho, Flipkart, Shopify)",
      "Official GSTR-1 Excel & JSON exports",
      "Validation & Error Centre",
      "Returns / Credit Notes adjustment",
      "HSN Summary & ECO Table 14",
    ],
    capabilities: {
      marketplaceImports: true,
      gstr1Excel: true,
      gstr1Json: true,
      validationEngine: true,
      errorCenter: true,
      hsnSummary: true,
      ecoTable14: true,
      basicReconciliation: true,
      advancedReconciliation: false,
      aiCorrections: false,
      gstr1Comparison: false,
      bulkProcessing: false,
      advancedAuditReports: false,
      teamMembers: false,
      bulkClientProcessing: false,
      zipDownloads: false,
      clientManagement: false,
      advancedAiReview: false,
      firmLevelReporting: false,
      whiteLabel: false,
      firmBranding: false,
      clientPortal: false,
      advancedAnalytics: false,
      apiAccess: false,
      prioritySupport: false,
    },
  },

  starter: {
    slug: "starter",
    name: "Starter",
    monthlyPrice: 79,
    currency: "INR",
    includedGSTINs: 10,
    durationDays: 30,
    description: "Ideal for individual accountants and growing sellers managing multiple GSTINs",
    features: [
      "10 GSTIN client capacity",
      "Unlimited GSTR-1 generations",
      "All marketplace imports & auto-detection",
      "Official GSTR-1 Excel & JSON exports",
      "Validation & Error Centre",
      "HSN Summary & Returns handling",
      "Basic reconciliation",
      "Standard email support",
    ],
    capabilities: {
      marketplaceImports: true,
      gstr1Excel: true,
      gstr1Json: true,
      validationEngine: true,
      errorCenter: true,
      hsnSummary: true,
      ecoTable14: true,
      basicReconciliation: true,
      advancedReconciliation: false,
      aiCorrections: false,
      gstr1Comparison: false,
      bulkProcessing: false,
      advancedAuditReports: false,
      teamMembers: false,
      bulkClientProcessing: false,
      zipDownloads: false,
      clientManagement: false,
      advancedAiReview: false,
      firmLevelReporting: false,
      whiteLabel: false,
      firmBranding: false,
      clientPortal: false,
      advancedAnalytics: false,
      apiAccess: false,
      prioritySupport: false,
    },
  },

  growth: {
    slug: "growth",
    name: "Growth",
    monthlyPrice: 129,
    currency: "INR",
    includedGSTINs: 15,
    durationDays: 30,
    badge: "Most Popular",
    isPopular: true,
    description: "Complete compliance suite with AI corrections, comparison & Table 14",
    features: [
      "15 GSTIN client capacity",
      "Unlimited GSTR-1 generations",
      "Everything in Starter",
      "Advanced TCS & Sales reconciliation",
      "ECO / Table 14 automated reporting",
      "AI-assisted anomaly & state correction",
      "GSTR-1 Portal vs Output comparison",
      "Bulk processing & priority queue",
    ],
    capabilities: {
      marketplaceImports: true,
      gstr1Excel: true,
      gstr1Json: true,
      validationEngine: true,
      errorCenter: true,
      hsnSummary: true,
      ecoTable14: true,
      basicReconciliation: true,
      advancedReconciliation: true,
      aiCorrections: true,
      gstr1Comparison: true,
      bulkProcessing: true,
      advancedAuditReports: false,
      teamMembers: false,
      bulkClientProcessing: false,
      zipDownloads: false,
      clientManagement: false,
      advancedAiReview: false,
      firmLevelReporting: false,
      whiteLabel: false,
      firmBranding: false,
      clientPortal: false,
      advancedAnalytics: false,
      apiAccess: false,
      prioritySupport: true,
    },
  },

  business: {
    slug: "business",
    name: "Business",
    monthlyPrice: 199,
    currency: "INR",
    includedGSTINs: 30,
    durationDays: 30,
    description: "Designed for multi-brand e-commerce operators and high-volume practices",
    features: [
      "30 GSTIN client capacity",
      "Unlimited GSTR-1 generations",
      "Everything in Growth",
      "Advanced bulk batch processing",
      "Multi-marketplace automated workflows",
      "Advanced audit & mismatch reports",
      "Priority customer support",
    ],
    capabilities: {
      marketplaceImports: true,
      gstr1Excel: true,
      gstr1Json: true,
      validationEngine: true,
      errorCenter: true,
      hsnSummary: true,
      ecoTable14: true,
      basicReconciliation: true,
      advancedReconciliation: true,
      aiCorrections: true,
      gstr1Comparison: true,
      bulkProcessing: true,
      advancedAuditReports: true,
      teamMembers: false,
      bulkClientProcessing: true,
      zipDownloads: true,
      clientManagement: true,
      advancedAiReview: false,
      firmLevelReporting: false,
      whiteLabel: false,
      firmBranding: false,
      clientPortal: false,
      advancedAnalytics: false,
      apiAccess: false,
      prioritySupport: true,
    },
  },

  ca_pro: {
    slug: "ca_pro",
    name: "CA Pro",
    monthlyPrice: 399,
    currency: "INR",
    includedGSTINs: 75,
    durationDays: 30,
    badge: "Best for CA Firms",
    description: "Full-scale CA practice suite with client workspace & multi-user collaboration",
    features: [
      "75 GSTIN client capacity",
      "Unlimited GSTR-1 generations",
      "Everything in Business",
      "Team member seats & shared capacity",
      "Bulk client batch processing",
      "One-click ZIP downloads",
      "Comprehensive client management",
      "Advanced AI return review",
      "Firm-level filing status reporting",
    ],
    capabilities: {
      marketplaceImports: true,
      gstr1Excel: true,
      gstr1Json: true,
      validationEngine: true,
      errorCenter: true,
      hsnSummary: true,
      ecoTable14: true,
      basicReconciliation: true,
      advancedReconciliation: true,
      aiCorrections: true,
      gstr1Comparison: true,
      bulkProcessing: true,
      advancedAuditReports: true,
      teamMembers: true,
      bulkClientProcessing: true,
      zipDownloads: true,
      clientManagement: true,
      advancedAiReview: true,
      firmLevelReporting: true,
      whiteLabel: false,
      firmBranding: false,
      clientPortal: false,
      advancedAnalytics: true,
      apiAccess: false,
      prioritySupport: true,
    },
  },

  ca_firm: {
    slug: "ca_firm",
    name: "CA Firm",
    monthlyPrice: 799,
    currency: "INR",
    includedGSTINs: 200,
    durationDays: 30,
    badge: "Enterprise",
    description: "Enterprise tier with white-label reports, custom branding and API readiness",
    features: [
      "200 GSTIN client capacity",
      "Unlimited GSTR-1 generations",
      "Everything in CA Pro",
      "Multiple team member accounts",
      "White-label exports with CA firm branding",
      "Client portal foundations",
      "Advanced practice analytics",
      "API-ready architecture",
      "Dedicated account manager & priority support",
    ],
    capabilities: {
      marketplaceImports: true,
      gstr1Excel: true,
      gstr1Json: true,
      validationEngine: true,
      errorCenter: true,
      hsnSummary: true,
      ecoTable14: true,
      basicReconciliation: true,
      advancedReconciliation: true,
      aiCorrections: true,
      gstr1Comparison: true,
      bulkProcessing: true,
      advancedAuditReports: true,
      teamMembers: true,
      bulkClientProcessing: true,
      zipDownloads: true,
      clientManagement: true,
      advancedAiReview: true,
      firmLevelReporting: true,
      whiteLabel: true,
      firmBranding: true,
      clientPortal: true,
      advancedAnalytics: true,
      apiAccess: true,
      prioritySupport: true,
    },
  },
};

export function getPlanDefinition(slug: string | null | undefined): PlanDefinition {
  if (!slug) return PLANS.free_trial;
  const normalized = slug.toLowerCase() as PlanSlug;
  return PLANS[normalized] ?? PLANS.free_trial;
}

export const ALL_PLANS: PlanDefinition[] = [
  PLANS.free_trial,
  PLANS.starter,
  PLANS.growth,
  PLANS.business,
  PLANS.ca_pro,
  PLANS.ca_firm,
];

export function getAllPlans(): PlanDefinition[] {
  return ALL_PLANS;
}

export function isPaidPlan(slug: string | null | undefined): boolean {
  if (!slug) return false;
  const s = slug.toLowerCase();
  return s !== "free" && s !== "free_trial";
}
