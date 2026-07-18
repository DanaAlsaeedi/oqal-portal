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
  if (batch.status !== "running") {
    return NextResponse.json(
      { error: "Batch is not running" },
      { status: 400 }
    );
  }

  await prisma.batch.update({
    where: { id },
    data: { status: "paused" },
  });

  await prisma.debtor.updateMany({
    where: { batchId: id, status: "pending" },
    data: { status: "paused" },
  });

  // Notify n8n to stop processing
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  if (n8nWebhookUrl) {
    try {
      await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: id, action: "pause" }),
      });
    } catch (err) {
      console.error("Failed to notify n8n pause:", err);
    }
  }

  return NextResponse.json({ status: "paused" });
}
