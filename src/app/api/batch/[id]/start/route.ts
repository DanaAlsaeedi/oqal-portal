import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = session.user as SessionUser;

  const batch = await prisma.batch.findUnique({ where: { id } });
  if (!batch) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.role !== "admin" && batch.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!["ready", "paused"].includes(batch.status)) {
    return NextResponse.json(
      { error: "Batch cannot be started from current status" },
      { status: 400 }
    );
  }

  await prisma.batch.update({
    where: { id },
    data: { status: "running" },
  });

  // Reset paused debtors back to pending
  await prisma.debtor.updateMany({
    where: { batchId: id, status: "paused" },
    data: { status: "pending" },
  });

  const debtors = await prisma.debtor.findMany({
    where: { batchId: id, status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  // Trigger n8n webhook OR Python notebook endpoint with the debtor list
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  if (n8nWebhookUrl && debtors.length > 0) {
    try {
      await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: id,
          action: "start",
          debtors: debtors.map((d) => ({
            id: d.id,
            client_name: d.clientName,
            phone_number: d.phoneNumber,
            reference_id: d.referenceId || "",
            debt_value_sar: d.debtValueSar,
            debt_age_days: d.debtAgeDays,
            company_name: d.companyName || "",
            number_of_attempts: d.attempts,
          })),
          callbackUrl:
            process.env.NEXTAUTH_URL + "/api/webhook/call-result",
        }),
      });
    } catch (err) {
      console.error("Failed to trigger collection engine:", err);
    }
  }

  return NextResponse.json({ status: "running", pendingDebtors: debtors.length });
}
