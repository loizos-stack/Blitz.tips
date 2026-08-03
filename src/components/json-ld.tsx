import { siteUrl } from "@/lib/site";

// Renders a JSON-LD structured-data script. `<` is escaped so nothing in the
// data (handicapper names, review text, …) can break out of the script tag.
function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function OrganizationJsonLd() {
  const base = siteUrl();
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Blitz.tips",
        url: base,
        logo: `${base}/icon.svg`,
        description:
          "A marketplace of verified sports handicappers with transparent, auto-tracked records.",
      }}
    />
  );
}

export function WebSiteJsonLd() {
  const base = siteUrl();
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Blitz.tips",
        url: base,
        // Sitelinks searchbox → the homepage handicapper finder.
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${base}/?q={search_term_string}#find`,
          },
          "query-input": "required name=search_term_string",
        },
      }}
    />
  );
}

export function FaqJsonLd({ items }: { items: { question: string; answer: string }[] }) {
  if (items.length === 0) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((it) => ({
          "@type": "Question",
          name: it.question,
          acceptedAnswer: { "@type": "Answer", text: it.answer },
        })),
      }}
    />
  );
}

export function ArticleJsonLd({
  title,
  description,
  slug,
  image,
  publishedAt,
  updatedAt,
  authorName,
}: {
  title: string;
  description: string;
  slug: string;
  image?: string | null;
  publishedAt: string;
  updatedAt: string;
  authorName: string;
}) {
  const base = siteUrl();
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: title,
        description,
        url: `${base}/blog/${slug}`,
        mainEntityOfPage: `${base}/blog/${slug}`,
        datePublished: publishedAt,
        dateModified: updatedAt,
        author: { "@type": "Organization", name: authorName },
        publisher: {
          "@type": "Organization",
          name: "Blitz.tips",
          logo: { "@type": "ImageObject", url: `${base}/icon.svg` },
        },
        ...(image ? { image: [image] } : {}),
      }}
    />
  );
}

/**
 * Breadcrumb trail for a nested page.
 *
 * Google renders these in place of the raw URL in a result, which reads better
 * and shows the section a page belongs to — worth having on anything more than
 * one level deep.
 */
export function BreadcrumbJsonLd({ items }: { items: { name: string; path: string }[] }) {
  if (items.length === 0) return null;
  const base = siteUrl();
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: `${base}${item.path}`,
        })),
      }}
    />
  );
}

export function HandicapperJsonLd({
  handle,
  displayName,
  bio,
  avatarUrl,
  ratingValue,
  reviewCount,
  prices,
  currency = "USD",
}: {
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  ratingValue: number | null;
  reviewCount: number;
  /** Subscription prices in minor units; null/absent tiers are skipped. */
  prices?: { weekly: number | null; monthly: number | null; annual: number | null };
  currency?: string;
}) {
  const base = siteUrl();
  const url = `${base}/handicappers/${handle}`;
  const person: Record<string, unknown> = {
    "@type": "Person",
    name: displayName,
    alternateName: `@${handle}`,
    url,
    ...(bio ? { description: bio } : {}),
    ...(avatarUrl ? { image: avatarUrl } : {}),
  };
  if (ratingValue != null && reviewCount > 0) {
    person.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue,
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  // The subscription tiers, so a result can carry a price. Modelled as a
  // Service rather than a Product — what's sold is access to someone's picks,
  // not an object — with one Offer per tier the handicapper actually offers.
  const offers = [
    { period: "P1W", label: "Weekly", cents: prices?.weekly ?? null },
    { period: "P1M", label: "Monthly", cents: prices?.monthly ?? null },
    { period: "P1Y", label: "Annual", cents: prices?.annual ?? null },
  ]
    .filter((tier) => tier.cents != null && tier.cents > 0)
    .map((tier) => ({
      "@type": "Offer",
      name: `${tier.label} subscription`,
      price: (tier.cents! / 100).toFixed(2),
      priceCurrency: currency,
      url,
      availability: "https://schema.org/InStock",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: (tier.cents! / 100).toFixed(2),
        priceCurrency: currency,
        billingDuration: tier.period,
      },
    }));

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: person,
  };
  if (offers.length > 0) {
    data.mainEntity = {
      ...person,
      makesOffer: {
        "@type": "Service",
        name: `${displayName}'s premium sports picks`,
        serviceType: "Sports handicapping subscription",
        provider: { "@type": "Person", name: displayName, url },
        offers,
      },
    };
  }

  return <JsonLd data={data} />;
}
