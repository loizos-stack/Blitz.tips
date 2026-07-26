// Categories shown in the contact forms and stored on the ticket. Shared by the
// client forms and the server API so the list (and validation) stays in sync.
// Not server-only — imported by client components.
export const TICKET_CATEGORIES = [
  "General",
  "Payments & Withdrawals",
  "Rules & Regulations",
  "Contests",
  "Feature Request",
  "Other",
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const DEFAULT_TICKET_CATEGORY: TicketCategory = "General";

export function isTicketCategory(value: unknown): value is TicketCategory {
  return typeof value === "string" && (TICKET_CATEGORIES as readonly string[]).includes(value);
}
