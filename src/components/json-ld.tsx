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

export function HandicapperJsonLd({
  handle,
  displayName,
  bio,
  avatarUrl,
  ratingValue,
  reviewCount,
}: {
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  ratingValue: number | null;
  reviewCount: number;
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
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        mainEntity: person,
      }}
    />
  );
}
