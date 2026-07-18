import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    debtorId,
    batchId,
    callId,
    status,
    callOutcome,
    callSummary,
    ptpAmount,
    ptpDate,
    payProbability,
    sentiment,
    transcript,
  } = body;

  if (!debtorId) {
    return NextResponse.json({ error: "Missing debtorId" }, { status: 400 });
  }

  await prisma.debtor.update({
    where: { id: debtorId },
    data: {
      status: status || "completed",
      callId: callId || null,
      callOutcome: callOutcome || null,
      callSummary: callSummary || null,
      ptpAmount: ptpAmount ? parseFloat(ptpAmount) : null,
      ptpDate: ptpDate || null,
      payProbability: payProbability ? parseInt(payProbability) : null,
      sentiment: sentiment || null,
      transcript: transcript || null,
      attempts: { increment: 1 },
      lastCallAt: new Date(),
    },
  });

  if (batchId) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: { _count: { select: { debtors: true } } },
    });

    if (batch) {
      const processed = await prisma.debtor.count({
        where: {
          batchId,
          status: { notIn: ["pending", "calling", "paused"] },
        },
      });

      const allDone = processed >= batch.totalDebtors;

      await prisma.batch.update({
        where: { id: batchId },
        data: {
          processedCount: processed,
          ...(allDone ? { status: "completed" } : {}),
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
