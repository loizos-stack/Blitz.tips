import { Suspense } from "react";
import { guardAdminPage } from "@/lib/permissions";
import { trafficReport, RETENTION_DAYS } from "@/lib/traffic";
import { TrafficReportView } from "@/components/admin/traffic-report";

export const dynamic = "force-dynamic";

const ALLOWED_RANGES = [7, 30, 90];

export default async function AdminTrafficPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await guardAdminPage("traffic");

  const params = await searchParams;
  // Clamped to the ranges the UI offers: the window goes straight into a date
  // calculation behind a table scan, and an arbitrary number from a query
  // string has no business deciding how much of it to read.
  const asked = Number(params.days);
  const days = ALLOWED_RANGES.includes(asked) ? asked : 30;

  const report = await trafficReport(days);

  return (
    // useSearchParams needs a boundary; the report is already loaded so the
    // fallback is only ever a frame.
    <Suspense fallback={null}>
      <TrafficReportView days={days} retentionDays={RETENTION_DAYS} {...report} />
    </Suspense>
  );
}
