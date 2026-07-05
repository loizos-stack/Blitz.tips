import { prisma } from "@/lib/prisma";
import { EmailComposer } from "@/components/admin/email-composer";

export const dynamic = "force-dynamic";

export default async function AdminEmailsPage() {
  const [all, handicappers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { handicapper: { isNot: null } } }),
  ]);

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Send an announcement to your users via Resend. Choose the audience, write the message, and
        it goes out wrapped in the Blitz.tips email template with an unsubscribe-style footer.
      </p>
      <EmailComposer
        counts={{ ALL: all, HANDICAPPERS: handicappers, CUSTOMERS: all - handicappers }}
      />
    </div>
  );
}
