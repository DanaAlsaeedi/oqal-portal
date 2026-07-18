import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import type { ColumnMapping, SessionUser } from "@/lib/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const where = user.role === "admin" ? {} : { userId: user.id };

  const batches = await prisma.batch.findMany({
    where,
    include: {
      user: { select: { name: true, email: true, company: true } },
      _count: { select: { debtors: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ batches });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string;
  const mappingsJson = formData.get("mappings") as string;

  if (!file || !name || !mappingsJson) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const mappings: ColumnMapping[] = JSON.parse(mappingsJson);
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const fieldMap: Record<string, string> = {};
  for (const m of mappings) {
    if (m.targetField) {
      fieldMap[m.targetField] = m.sourceColumn;
    }
  }

  const getValue = (row: Record<string, unknown>, field: string) => {
    const col = fieldMap[field];
    if (!col) return "";
    return String(row[col] ?? "");
  };

  const batch = await prisma.batch.create({
    data: {
      userId: user.id,
      name,
      status: "ready",
      totalDebtors: data.length,
      columnMapping: JSON.stringify(mappings),
      originalFileName: file.name,
      debtors: {
        create: data.map((row) => ({
          clientName: getValue(row, "clientName") || "Unknown",
          phoneNumber: getValue(row, "phoneNumber") || "",
          referenceId: getValue(row, "referenceId") || null,
          debtValueSar: parseFloat(getValue(row, "debtValueSar")) || 0,
          debtAgeDays: parseInt(getValue(row, "debtAgeDays")) || 0,
          companyName: getValue(row, "companyName") || null,
          rawData: JSON.stringify(row),
        })),
      },
    },
  });

  return NextResponse.json({ batch });
}
