import type { Metadata } from "next";

/**
 * SEO and answer-engine helpers. Every public page gets a canonical URL, a complete Open Graph card,
 * and JSON-LD that says plainly what the page is, so search engines and AI assistants can quote it.
 */

export const SITE = {
  name: "ExplainCanvas",
  url: process.env.APP_URL ?? "https://explaincanvas.com",
  tagline: "Type anything you are stuck on. Understand it visually.",
  description: "AI explanations for CBSE Classes 6 to 10 that arrive as a diagram, steps, slides, an animation or a 3D model, checked for accuracy, with one check question and a daily parent report.",
  email: "hello@explaincanvas.com",
  twitter: "@explaincanvas",
};

export function pageMetadata(input: { title: string; description: string; path: string; keywords?: string[]; noindex?: boolean }): Metadata {
  const url = `${SITE.url}${input.path}`;
  return {
    title: input.title,
    description: input.description,
    keywords: input.keywords,
    alternates: { canonical: url },
    robots: input.noindex ? { index: false, follow: false } : undefined,
    openGraph: { title: input.title, description: input.description, url, siteName: SITE.name, type: "website", locale: "en_IN" },
    twitter: { card: "summary_large_image", title: input.title, description: input.description },
  };
}

export type JsonLd = Record<string, unknown>;

export function organizationLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/logo-1024.png`,
    email: SITE.email,
    description: SITE.description,
    areaServed: "IN",
    contactPoint: [{ "@type": "ContactPoint", email: SITE.email, contactType: "customer support", availableLanguage: ["en"] }],
  };
}

export function websiteLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    description: SITE.tagline,
    inLanguage: "en-IN",
    potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/library?subject={search_term_string}` }, "query-input": "required name=search_term_string" },
  };
}

export function softwareLd(prices: { name: string; pricePaise: number; interval: "month" | "year" | "none" }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    url: SITE.url,
    description: SITE.description,
    audience: { "@type": "EducationalAudience", educationalRole: "student", audienceType: "CBSE Classes 6 to 10" },
    offers: prices.map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: (p.pricePaise / 100).toFixed(0),
      priceCurrency: "INR",
      category: p.interval === "none" ? "free" : "subscription",
      availability: "https://schema.org/InStock",
      url: `${SITE.url}/pricing`,
    })),
  };
}

export function faqLd(items: { q: string; a: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE.url}${it.path}` })),
  };
}

export function learningResourceLd(input: { title: string; description: string; path: string; classLevel: number; subject: string; dateModified?: string }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: input.title,
    description: input.description,
    url: `${SITE.url}${input.path}`,
    inLanguage: "en-IN",
    isAccessibleForFree: true,
    learningResourceType: "visual explanation",
    educationalLevel: `Class ${input.classLevel}`,
    about: input.subject,
    educationalAlignment: { "@type": "AlignmentObject", alignmentType: "educationalSubject", educationalFramework: "CBSE", targetName: input.subject },
    provider: { "@type": "Organization", name: SITE.name, url: SITE.url },
    dateModified: input.dateModified,
  };
}

/** Serialises JSON-LD safely for a <script> tag (no "</script>" breakouts). */
export function ldJson(...docs: JsonLd[]): string {
  return JSON.stringify(docs.length === 1 ? docs[0] : docs).replace(/</g, "\\u003c");
}
