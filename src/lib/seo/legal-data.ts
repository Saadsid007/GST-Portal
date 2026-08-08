import { SITE } from "@/config/site";

/**
 * Legal and policy page content.
 *
 * Held as data rather than JSX so every policy page renders through one shell,
 * shares one table-of-contents mechanism, and can be listed in the sitemap and
 * footer from a single source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS A DRAFT, NOT LEGAL ADVICE.
 *
 * These documents are written to be accurate about how GSTPilot actually
 * behaves — what data the code stores, what the wallet does, how refunds work
 * — and to cover what Razorpay expects from an Indian merchant. They are a
 * solid starting point, not a substitute for review by a lawyer familiar with
 * the IT Act 2000, the SPDI Rules 2011 and the DPDP Act 2023.
 *
 * Placeholders that MUST be filled before launch are marked [[ ]] below.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Change this when you materially revise any policy. */
export const POLICY_LAST_UPDATED = "6 August 2026";

/** Fill these in before going live. They appear verbatim in the documents. */
export const LEGAL_ENTITY = {
  /** Registered company or proprietorship name. */
  name: "[[REGISTERED ENTITY NAME]]",
  /** Full registered address including PIN. */
  address: "[[REGISTERED ADDRESS, CITY, STATE, PIN]]",
  supportEmail: "support@gstpilot.in",
  grievanceEmail: "grievance@gstpilot.in",
  /** Required by the IT Rules for a grievance officer. */
  grievanceOfficer: "[[GRIEVANCE OFFICER NAME]]",
  phone: "[[SUPPORT PHONE]]",
  /** Governing courts for disputes. */
  jurisdiction: "[[CITY]], India",
} as const;

export interface LegalSection {
  id: string;
  heading: string;
  /** Paragraphs. Rendered as <p>. */
  body?: string[];
  /** Optional bullet list rendered after the paragraphs. */
  bullets?: string[];
}

export interface LegalDocument {
  slug: string;
  title: string;
  /** Used in <title> and the hero. */
  metaTitle: string;
  metaDescription: string;
  /** One-line summary under the page title. */
  summary: string;
  /** Shown in the footer and the policy index. */
  footerLabel: string;
  sections: LegalSection[];
}

const SUPPORT = LEGAL_ENTITY.supportEmail;

/* ── Terms of Service ─────────────────────────────────────────────────────── */

const terms: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  metaTitle: "Terms of Service",
  metaDescription:
    "The terms governing your use of GSTPilot: accounts, wallet credits, acceptable use, accuracy of generated GSTR-1 files, liability and governing law.",
  summary: "The agreement between you and GSTPilot when you use the platform.",
  footerLabel: "Terms of Service",
  sections: [
    {
      id: "acceptance",
      heading: "1. Acceptance of these terms",
      body: [
        `These Terms of Service govern your access to and use of ${SITE.name} (the "Service"), operated by ${LEGAL_ENTITY.name} ("we", "us"). By creating an account or using the Service you agree to these terms. If you are agreeing on behalf of a company, you confirm you are authorised to bind it.`,
        "If you do not agree with any part of these terms, do not use the Service.",
      ],
    },
    {
      id: "what-we-do",
      heading: "2. What the Service does — and does not do",
      body: [
        "GSTPilot converts sales reports exported from e-commerce marketplaces into GSTR-1 JSON and Excel files formatted to the GSTN schema. It reads the files you upload, normalises them, nets sales against returns, and produces output for you to review and file.",
        "GSTPilot is a file conversion and data preparation tool. It is not a tax advisor, chartered accountant, or GST Suvidha Provider, and it does not file returns on your behalf.",
      ],
      bullets: [
        "We do not submit anything to the GST portal for you.",
        "We do not provide tax, legal or accounting advice.",
        "Output is generated from the data you supply. Garbage in, garbage out applies.",
        "You remain solely responsible for reviewing every return before filing it.",
      ],
    },
    {
      id: "accounts",
      heading: "3. Your account",
      body: [
        "You must provide accurate information when registering and keep it current. You are responsible for everything that happens under your account and for keeping your password confidential.",
        `Tell us immediately at ${SUPPORT} if you believe your account has been accessed without your authorisation.`,
        "You must be at least 18 years old and capable of entering a binding contract under the Indian Contract Act, 1872.",
      ],
    },
    {
      id: "credits",
      heading: "4. Wallet credits and payment",
      body: [
        "The Service is prepaid. You add credits to a wallet and each GSTR-1 generation deducts a fixed number of credits, shown on the pricing page before you pay.",
        "One credit equals one Indian Rupee. Bonus credits granted on larger recharges, through referrals, or via promotional codes are promotional in nature: they carry no cash value and are not redeemable for money.",
        "Payments are processed by Razorpay. We do not receive or store your card, UPI or bank credentials at any point.",
        "Prices and the credit cost per generation may change. Changes apply to future recharges only and never retroactively to credits you already hold.",
      ],
    },
    {
      id: "free-trial",
      heading: "5. Free trial",
      body: [
        "New accounts receive a limited number of free generations. Files produced during the free trial carry a visible watermark. The trial is per account, and creating additional accounts to obtain further free generations is a breach of these terms.",
      ],
    },
    {
      id: "acceptable-use",
      heading: "6. Acceptable use",
      body: ["You agree not to:"],
      bullets: [
        "Upload data you do not have the right to process, or another person's data without their authority.",
        "Use the Service to prepare returns you know to be false or misleading.",
        "Attempt to gain unauthorised access to the Service, other accounts, or our infrastructure.",
        "Reverse engineer, scrape, or resell the Service or its output as your own product without a written agreement.",
        "Circumvent credit deduction, the free trial limit, or any other usage control.",
        "Upload malware, or files intended to disrupt or overload the Service.",
      ],
    },
    {
      id: "accuracy",
      heading: "7. Accuracy and your responsibility to review",
      body: [
        "We work hard to parse marketplace formats correctly and to flag problems before you file. Marketplaces change their export formats without notice, and source data is frequently incomplete or inconsistent.",
        "You must review every generated return against your own records before submitting it to the GST portal. Any interest, penalty, notice or demand arising from a filed return is your responsibility.",
      ],
    },
    {
      id: "availability",
      heading: "8. Availability",
      body: [
        "We aim to keep the Service available continuously but do not guarantee uninterrupted access. We may suspend it for maintenance, and we may change or discontinue features.",
        "If we discontinue the Service entirely, we will give reasonable notice and refund unused recharged credits in line with the Refund Policy.",
      ],
    },
    {
      id: "ip",
      heading: "9. Intellectual property",
      body: [
        `The Service, its software, design and content are owned by ${LEGAL_ENTITY.name} and protected by Indian and international law. These terms grant you a limited, non-exclusive, non-transferable right to use the Service — not to own any part of it.`,
        "Your data remains yours. Files you upload and returns you generate belong to you. You grant us only the licence needed to process them and deliver the Service to you.",
        "Marketplace names and logos referenced on this site are the trademarks of their respective owners. Their use is descriptive and does not imply partnership or endorsement.",
      ],
    },
    {
      id: "termination",
      heading: "10. Suspension and termination",
      body: [
        "You may stop using the Service and close your account at any time.",
        "We may suspend or terminate an account that breaches these terms, is used fraudulently, or creates a risk to the Service or other users. Where a breach is not deliberate, we will normally contact you first.",
        "On termination for breach, unused promotional and bonus credits lapse. Unused credits you paid for are handled under the Refund Policy.",
      ],
    },
    {
      id: "liability",
      heading: "11. Limitation of liability",
      body: [
        "To the maximum extent permitted by law, we are not liable for indirect, incidental or consequential loss, including lost profits, lost business or tax penalties, arising from your use of the Service.",
        "Our total aggregate liability for any claim is limited to the amount you paid us in the twelve months preceding the event giving rise to the claim.",
        "Nothing in these terms excludes liability that cannot be excluded under Indian law, including liability for fraud.",
      ],
    },
    {
      id: "changes",
      heading: "12. Changes to these terms",
      body: [
        "We may update these terms. Material changes will be notified in the application or by email before they take effect. Continuing to use the Service after that constitutes acceptance.",
      ],
    },
    {
      id: "law",
      heading: "13. Governing law and disputes",
      body: [
        `These terms are governed by the laws of India. The courts at ${LEGAL_ENTITY.jurisdiction} have exclusive jurisdiction over any dispute.`,
        `Before starting proceedings, please contact us at ${SUPPORT}. Most disputes are resolved faster by talking to us.`,
      ],
    },
    {
      id: "contact",
      heading: "14. Contact",
      body: [`${LEGAL_ENTITY.name}`, LEGAL_ENTITY.address, `Email: ${SUPPORT}`],
    },
  ],
};

/* ── Privacy Policy ───────────────────────────────────────────────────────── */

const privacy: LegalDocument = {
  slug: "privacy-policy",
  title: "Privacy Policy",
  metaTitle: "Privacy Policy",
  metaDescription:
    "What GSTPilot collects, why, how long it is kept, who it is shared with, and the rights you have over your data under Indian law.",
  summary: "What we collect, why we collect it, and what you can do about it.",
  footerLabel: "Privacy Policy",
  sections: [
    {
      id: "scope",
      heading: "1. Scope",
      body: [
        `This policy explains how ${LEGAL_ENTITY.name} handles personal information when you use ${SITE.name}. It is written to comply with the Information Technology Act 2000, the SPDI Rules 2011, and the Digital Personal Data Protection Act 2023.`,
      ],
    },
    {
      id: "what-we-collect",
      heading: "2. What we collect",
      body: ["We collect only what the Service needs to function."],
      bullets: [
        "Account details: your name, email address and password (stored only as a cryptographic hash — we cannot read it).",
        "GSTIN profiles: the GSTINs, legal and trade names, state and nature of business you enter.",
        "Uploaded reports: the marketplace files you submit for conversion, processed to produce your return.",
        "Conversion history: metadata about each generated return — period, totals, platforms, status.",
        "Wallet and transaction records: recharges, credit deductions, bonuses and referral rewards.",
        "Support messages: anything you send through the contact or support forms.",
        "Technical logs: IP address, browser type and timestamps, kept for security and debugging.",
      ],
    },
    {
      id: "what-we-dont",
      heading: "3. What we never collect",
      bullets: [
        "Card numbers, CVV, UPI PINs or net-banking credentials. Payments go directly to Razorpay; those details never reach our servers.",
        "Your GST portal username or password. We do not log in to the portal on your behalf.",
      ],
    },
    {
      id: "why",
      heading: "4. Why we process it",
      bullets: [
        "To provide the Service — parsing your files and generating returns.",
        "To operate your wallet and process payments.",
        "To keep a filing history you can return to.",
        "To answer support requests.",
        "To detect fraud, abuse and security incidents.",
        "To meet legal and tax record-keeping obligations.",
      ],
    },
    {
      id: "sharing",
      heading: "5. Who we share it with",
      body: [
        "We do not sell your data. We do not share it for advertising. We share it only with processors that make the Service work:",
      ],
      bullets: [
        "Razorpay — payment processing. Governed by Razorpay's own privacy policy.",
        "Our hosting and database providers — infrastructure on which the Service runs.",
        "Law enforcement or regulators, where we are legally required to do so.",
      ],
    },
    {
      id: "retention",
      heading: "6. How long we keep it",
      body: [
        "Account and GSTIN profile data is kept while your account is open.",
        "Conversion history and wallet ledgers are retained for the period required by Indian tax record-keeping rules, which can be several years, because they evidence transactions.",
        "Uploaded source files are processed to produce your return and are not retained as long-term archives.",
        "Technical logs are kept for a limited period for security and debugging.",
      ],
    },
    {
      id: "security",
      heading: "7. Security",
      body: [
        "Data is encrypted in transit using TLS. Passwords are hashed. Administrative access is role-based and re-checked on every request rather than trusted from a session.",
        "No system is perfectly secure. If a breach affects your personal data we will notify you and the relevant authority as required by law.",
      ],
    },
    {
      id: "rights",
      heading: "8. Your rights",
      body: ["You may ask us to:"],
      bullets: [
        "Give you a copy of the personal data we hold about you.",
        "Correct anything inaccurate.",
        "Delete your account and associated personal data, subject to records we must retain by law.",
        "Withdraw consent for processing that relies on it.",
      ],
    },
    {
      id: "cookies",
      heading: "9. Cookies",
      body: [
        "We use only what the Service needs: a session cookie to keep you signed in, and a preference cookie remembering your theme and sidebar state. We do not use advertising or cross-site tracking cookies.",
        "Blocking the session cookie will prevent you from signing in.",
      ],
    },
    {
      id: "grievance",
      heading: "10. Grievance officer",
      body: [
        "In accordance with the Information Technology Act 2000 and the rules made under it, the contact details of our Grievance Officer are:",
        `${LEGAL_ENTITY.grievanceOfficer}`,
        `Email: ${LEGAL_ENTITY.grievanceEmail}`,
        LEGAL_ENTITY.address,
        "We aim to acknowledge grievances within 24 hours and resolve them within 15 days.",
      ],
    },
  ],
};

/* ── Refund & Cancellation ────────────────────────────────────────────────── */

const refund: LegalDocument = {
  slug: "refund-policy",
  title: "Refund & Cancellation Policy",
  metaTitle: "Refund & Cancellation Policy",
  metaDescription:
    "When GSTPilot refunds wallet recharges, how failed payments and duplicate debits are handled, and how to request a refund.",
  summary: "When you get your money back, and how to ask for it.",
  footerLabel: "Refund Policy",
  sections: [
    {
      id: "model",
      heading: "1. How billing works",
      body: [
        "GSTPilot is prepaid. You recharge a wallet with credits, and each GSTR-1 generation deducts a fixed number of credits. There is no subscription and no auto-renewal, so there is nothing to cancel to stop being charged — simply stop recharging.",
        "Credits do not expire.",
      ],
    },
    {
      id: "eligible",
      heading: "2. When we refund",
      bullets: [
        "Money was debited but credits never appeared in your wallet.",
        "You were charged more than once for the same recharge.",
        "The Service failed to generate a return because of a fault on our side and could not be made to work.",
        "You recharged by mistake and have not spent any of those credits — request within 7 days.",
        "We discontinue the Service while you hold unused recharged credits.",
      ],
    },
    {
      id: "not-eligible",
      heading: "3. When we do not refund",
      bullets: [
        "Credits already spent on generated returns. The output was delivered.",
        "Bonus, referral and promotional credits. These were never paid for and hold no cash value.",
        "A return you filed containing errors originating in the data you uploaded.",
        "Accounts terminated for breaching the Terms of Service.",
        "Dissatisfaction after substantial use, where the Service performed as described. The free trial exists so you can evaluate it before paying.",
      ],
    },
    {
      id: "failed",
      heading: "4. Failed payments and duplicate debits",
      body: [
        "If a payment fails, no credits are added and no money is captured. Banks occasionally show a pending debit that reverses on its own, usually within 5 to 7 working days.",
        `If a debit has not reversed after 7 working days, raise a support request with the payment reference and we will trace it with Razorpay. Include the UPI reference or order id — it turns a multi-day investigation into a single lookup.`,
      ],
    },
    {
      id: "how",
      heading: "5. How to request a refund",
      body: [
        "Raise a request from Support inside the application, or write to us. Include your registered email, the payment reference or amount and approximate time, and what went wrong.",
        `Email: ${SUPPORT}`,
      ],
    },
    {
      id: "timeline",
      heading: "6. Timeline",
      body: [
        "We acknowledge refund requests within 1 business day and decide within 5 business days.",
        "Approved refunds are issued to the original payment method through Razorpay. Once we initiate it, banks typically take a further 5 to 7 working days to credit your account. That final leg is outside our control.",
      ],
    },
  ],
};

/* ── Shipping & Delivery ──────────────────────────────────────────────────── */

const shipping: LegalDocument = {
  slug: "shipping-policy",
  title: "Delivery Policy",
  metaTitle: "Delivery Policy",
  metaDescription:
    "GSTPilot delivers digital services. How and when wallet credits and generated GSTR-1 files are delivered after payment.",
  summary: "GSTPilot is a digital service. Nothing is physically shipped.",
  footerLabel: "Delivery Policy",
  sections: [
    {
      id: "digital",
      heading: "1. Digital delivery only",
      body: [
        `${SITE.name} is a software service delivered entirely over the internet. No physical goods are sold, shipped or couriered, so no shipping charges apply and no delivery address is required.`,
        "This policy exists because payment providers require merchants to publish delivery terms, including where the product is digital.",
      ],
    },
    {
      id: "credits",
      heading: "2. Delivery of wallet credits",
      body: [
        "Credits are added to your wallet automatically as soon as your payment is confirmed by Razorpay — normally within seconds.",
        "If a payment succeeds but credits do not appear within 30 minutes, raise a support request with the payment reference. Settlement is idempotent, so a delayed confirmation credits your wallet exactly once when it arrives; you will never be double-credited.",
      ],
    },
    {
      id: "files",
      heading: "3. Delivery of generated files",
      body: [
        "GSTR-1 JSON, the GSTN workbook and the CA review report are generated on demand and downloaded directly from your browser at the end of a conversion.",
        "Previously generated returns remain available from your filing history for as long as your account is open.",
      ],
    },
    {
      id: "geography",
      heading: "4. Service area",
      body: [
        "The Service is intended for GST-registered businesses in India and is available wherever you can reach the internet.",
      ],
    },
    { id: "help", heading: "5. Problems with delivery", body: [`Contact ${SUPPORT}.`] },
  ],
};

/* ── Disclaimer ──────────────────────────────────────────────────────────── */

const disclaimer: LegalDocument = {
  slug: "disclaimer",
  title: "Disclaimer",
  metaTitle: "Disclaimer",
  metaDescription:
    "GSTPilot is a data preparation tool, not a tax advisor. What that means for the returns you file.",
  summary: "What GSTPilot is responsible for, and what remains yours.",
  footerLabel: "Disclaimer",
  sections: [
    {
      id: "not-advice",
      heading: "1. Not professional advice",
      body: [
        "Nothing on this website or in the application constitutes tax, legal or accounting advice. Guides, documentation and blog posts are general information and may not fit your circumstances. Consult a qualified chartered accountant or tax practitioner before acting.",
      ],
    },
    {
      id: "no-affiliation",
      heading: "2. No government affiliation",
      body: [
        `${SITE.name} is an independent, privately operated product. It is not affiliated with, endorsed by, or connected to the Goods and Services Tax Network (GSTN), the Central Board of Indirect Taxes and Customs (CBIC), or any government body. It is not a GST Suvidha Provider.`,
      ],
    },
    {
      id: "marketplaces",
      heading: "3. Marketplace trademarks",
      body: [
        "Amazon, Flipkart, Meesho, Myntra, JioMart and other marketplace names and logos are trademarks of their respective owners. References to them describe file formats we support. They do not imply any partnership, sponsorship or endorsement.",
      ],
    },
    {
      id: "accuracy",
      heading: "4. Accuracy of output",
      body: [
        "Generated files reflect the data you upload. Marketplaces change export formats without notice, and source files are often incomplete. We validate what we can and surface problems before generation, but we cannot guarantee that output is correct or complete.",
        "Review every return against your own records before filing. Responsibility for a filed return, and for any consequence of filing it, rests with you.",
      ],
    },
    {
      id: "external",
      heading: "5. External links",
      body: [
        "We link to third-party sites for reference. We do not control them and are not responsible for their content or practices.",
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  terms: terms,
  "privacy-policy": privacy,
  "refund-policy": refund,
  "shipping-policy": shipping,
  disclaimer: disclaimer,
};

export const LEGAL_SLUGS = Object.keys(LEGAL_DOCUMENTS);
