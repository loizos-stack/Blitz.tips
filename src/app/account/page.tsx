import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AccountDetailsForm } from "@/components/account/account-details-form";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export const metadata: Metadata = { title: "Account settings" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, country: true, username: true, passwordHash: true },
  });
  if (!user) redirect("/signin");

  return (
    <div className="container-page max-w-xl py-12">
      <h1 className="text-2xl font-bold">Account settings</h1>
      <p className="mt-1 text-sm text-muted">Manage your personal details and password.</p>

      <div className="mt-6 space-y-6">
        <AccountDetailsForm
          username={user.username}
          initialName={user.name ?? ""}
          initialEmail={user.email}
          initialCountry={user.country ?? ""}
        />
        <ChangePasswordForm hasPassword={Boolean(user.passwordHash)} />
      </div>
    </div>
  );
}
