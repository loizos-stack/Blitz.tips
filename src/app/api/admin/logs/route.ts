import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  const ctx = await requirePermission("audit");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const action = url.searchParams.get("action")?.trim() ?? "";
  const targetType = url.searchParams.get("targetType")?.trim() ?? "";
  const actor = url.searchParams.get("actor")?.trim() ?? "";
  const page = Math.max(0, Number(url.searchParams.get("page")) || 0);

  const where: Prisma.AdminAuditLogWhereInput = {};
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (actor) where.actorEmail = { contains: actor, mode: "insensitive" };
  if (q) {
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { detail: { contains: q, mode: "insensitive" } },
      { actorEmail: { contains: q, mode: "insensitive" } },
      { targetType: { contains: q, mode: "insensitive" } },
      { targetId: { contains: q, mode: "insensitive" } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    pageSize: PAGE_SIZE,
    pages: Math.ceil(total / PAGE_SIZE),
  });
}
