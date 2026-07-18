import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      debtors: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    batchId: batch.id,
    batchName: batch.name,
    status: batch.status,
    debtors: batch.debtors.map((d) => ({
      id: d.id,
      client_name: d.clientName,
      phone_number: d.phoneNumber,
      reference_id: d.referenceId || "",
      debt_value_sar: d.debtValueSar,
      debt_age_days: d.debtAgeDays,
      company_name: d.companyName || "",
      status: d.status,
      number_of_attempts: d.attempts,
    })),
  });
}
