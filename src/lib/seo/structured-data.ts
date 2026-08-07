import { SITE } from "@/config/site";
import { toAbsoluteUrl } from "@/lib/seo/routes";

/**
 * Structured data builders. Every field here must be true — fabricated ratings or
 * review counts are a manual-action risk, so no aggregateRating is emitted anywhere
 * until GSTPilot has real, verifiable reviews to point at.
 */

type JsonLd = Record<string, unknown>;

export function organizationSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}#organization`,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    areaServed: { "@type": "Country", name: "India" },
  };
}

export function webSiteSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}#website`,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    inLanguage: "en-IN",
    publisher: { "@id": `${SITE.url}#organization` },
  };
}

export function softwareApplicationSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Accounting Software",
    operatingSystem: "Web",
    publisher: { "@id": `${SITE.url}#organization` },
    // No aggregateRating: there are no verifiable public reviews to cite yet.
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
      description: "Free tier with paid conversion credits",
    },
  };
}

export function blogPostingSchema(post: {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedDate: string;
  updatedAt?: string;
}): JsonLd {
  const url = toAbsoluteUrl(`/blog/${post.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": url,
    headline: post.title,
    description: post.excerpt,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: post.publishedDate,
    dateModified: post.updatedAt ?? post.publishedDate,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@id": `${SITE.url}#organization` },
    inLanguage: "en-IN",
  };
}

export function articleSchema(doc: {
  slug: string;
  title: string;
  description: string;
  publishedAt?: string;
  updatedAt?: string;
}): JsonLd {
  const url = toAbsoluteUrl(`/docs/${doc.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "@id": url,
    headline: doc.title,
    description: doc.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(doc.publishedAt ? { datePublished: doc.publishedAt } : {}),
    ...(doc.updatedAt ? { dateModified: doc.updatedAt } : {}),
    author: { "@id": `${SITE.url}#organization` },
    publisher: { "@id": `${SITE.url}#organization` },
    inLanguage: "en-IN",
  };
}

export function faqPageSchema(faqs: ReadonlyArray<{ question: string; answer: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function breadcrumbSchema(trail: ReadonlyArray<{ name: string; path: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: toAbsoluteUrl(crumb.path),
    })),
  };
}

export function productSchema(
  offers: ReadonlyArray<{ name: string; price: number; description: string }>
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${SITE.name} Plans`,
    description: SITE.description,
    brand: { "@id": `${SITE.url}#organization` },
    offers: offers.map((offer) => ({
      "@type": "Offer",
      name: offer.name,
      price: String(offer.price),
      priceCurrency: "INR",
      description: offer.description,
      availability: "https://schema.org/InStock",
      url: toAbsoluteUrl("/pricing"),
    })),
  };
}
