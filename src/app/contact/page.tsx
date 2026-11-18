import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { DEFAULT_TICKET_CATEGORY, isTicketCategory } from "@/lib/ticket-categories";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Get in touch with the Blitz.tips team.",
  alternates: { canonical: "/contact" },
};

// `?category=` pre-selects the dropdown, so the contest pages can hand people
// straight to a contest ticket instead of asking them to classify it again.
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const defaultCategory = isTicketCategory(category) ? category : DEFAULT_TICKET_CATEGORY;

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold">Contact us</h1>
        <p className="mt-3 text-muted">
          Questions, feedback, or need a hand? Send us a message and we&rsquo;ll get back to you. You can
          also email{" "}
          <a href="mailto:support@blitz.tips" className="inline-flex items-center gap-1 text-accent hover:underline">
            <Mail className="h-4 w-4" /> support@blitz.tips
          </a>
          .
        </p>

        <div className="mt-8">
          <ContactForm defaultCategory={defaultCategory} />
        </div>
      </div>
    </div>
  );
}
