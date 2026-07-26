import type { Metadata } from "next";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { UnsubscribeButton } from "@/components/unsubscribe-button";

export const metadata: Metadata = { title: "Unsubscribe" };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = Boolean(verifyUnsubscribeToken(token));

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold">Unsubscribe</h1>
        {valid ? (
          <>
            <p className="mt-3 text-muted">
              Stop receiving marketing and notification emails from Blitz.tips? Important account and
              support emails (verification, receipts, ticket replies) will still be sent.
            </p>
            <div className="mt-6">
              <UnsubscribeButton token={token!} />
            </div>
          </>
        ) : (
          <p className="mt-3 text-muted">
            This unsubscribe link is invalid or has expired. You can manage your email preferences from
            your notification settings while signed in.
          </p>
        )}
      </div>
    </div>
  );
}
