import { prisma } from "@/lib/prisma";
import { EmailComposer } from "@/components/admin/email-composer";
import { guardAdminPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminEmailsPage() {
  await guardAdminPage("emails");
  const [all, handicappers, entrants] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { handicapper: { isNot: null } } }),
    prisma.user.count({ where: { contestEntries: { some: {} } } }),
  ]);

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Send an announcement to your users via Resend, or write to one person. Choose the audience,
        write the message, and it goes out wrapped in the Blitz.tips email template. A broadcast
        skips anyone who has unsubscribed and carries an unsubscribe footer; a message to one
        person is ordinary correspondence and carries neither.
      </p>
      <EmailComposer
        counts={{
          ALL: all,
          HANDICAPPERS: handicappers,
          CUSTOMERS: all - handicappers,
          CONTEST_ENTRANTS: entrants,
        }}
      />
    </div>
  );
}
